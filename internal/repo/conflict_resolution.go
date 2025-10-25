package repo

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/storage"
	"github.com/sergi/go-diff/diffmatchpatch"
)

type ConflictFile struct {
	FilePath     string `json:"filePath"`
	CurrentHash  string `json:"currentHash"`
	TargetHash   string `json:"targetHash"`
	AncestorHash string `json:"ancestorHash"`
	Content      string `json:"content"`
	Status       string `json:"status"`
}

type ConflictResolution struct {
	Parent       string         `json:"parent"`
	OtherParent  string         `json:"otherParent"`
	Conflicts    []ConflictFile `json:"conflicts"`
	Resolved     []string       `json:"resolved"`
	IsMergeState bool           `json:"isMergeState"`
	Message      string         `json:"message"`
}

func PerformAdvancedFileMerge(currentHash, targetHash string) (string, string, bool, error) {
	currentContent, err := storage.GetFileContentFromHash(currentHash)
	if err != nil {
		return "", "", false, fmt.Errorf("failed to get current content: %v", err)
	}

	targetContent, err := storage.GetFileContentFromHash(targetHash)
	if err != nil {
		return "", "", false, fmt.Errorf("failed to get target content: %v", err)
	}

	mergedContent, _, err := PerformLineByLineMerge(currentContent, targetContent)
	if err != nil {
		return "", "", false, fmt.Errorf("failed to perform line-by-line merge: %v", err)
	}

	contentBytes := []byte(mergedContent)
	contentHash := storage.Hash(contentBytes)
	err = storage.WriteObject(contentHash, contentBytes)
	if err != nil {
		return "", "", false, fmt.Errorf("failed to store merged content: %v", err)
	}

	return contentHash, mergedContent, false, nil
}

func PerformLineByLineMerge(current, target string) (string, bool, error) {
	dmp := diffmatchpatch.New()
	a, b, lineArray := dmp.DiffLinesToChars(current, target)
	diffs := dmp.DiffMain(a, b, false)
	diffs = dmp.DiffCharsToLines(diffs, lineArray)

	hasChanges := false
	for _, d := range diffs {
		if d.Type == diffmatchpatch.DiffDelete || d.Type == diffmatchpatch.DiffInsert {
			hasChanges = true
		}
	}

	if !hasChanges {
		return current, false, nil
	}

	if canAutoMerge(diffs) {
		mergedContent := autoMergeChanges(diffs)
		return mergedContent, false, nil
	}

	conflictContent := createConflictMarkers(diffs)
	return conflictContent, true, nil
}

func canAutoMerge(diff []diffmatchpatch.Diff) bool {
	hasInsertions := false
	hasDeletions := false

	for _, d := range diff {
		switch d.Type {
		case diffmatchpatch.DiffInsert:
			hasInsertions = true
		case diffmatchpatch.DiffDelete:
			hasDeletions = true
		}
	}

	return !(hasInsertions && hasDeletions)
}

func autoMergeChanges(diff []diffmatchpatch.Diff) string {
	var result strings.Builder

	for _, d := range diff {
		switch d.Type {
		case diffmatchpatch.DiffEqual:
			result.WriteString(d.Text)
		case diffmatchpatch.DiffInsert:
			result.WriteString(d.Text)
		case diffmatchpatch.DiffDelete:
			continue
		}
	}

	return result.String()
}

func createConflictMarkers(diffs []diffmatchpatch.Diff) string {
	var result strings.Builder
	for i := 0; i < len(diffs)-1; i++ {
		if diffs[i].Type == diffmatchpatch.DiffDelete && diffs[i+1].Type == diffmatchpatch.DiffInsert {
			result.WriteString("<<<<<<< HEAD (Current Branch)\n")
			result.WriteString(strings.TrimSpace(diffs[i].Text))
			result.WriteString("\n=======\n")
			result.WriteString(strings.TrimSpace(diffs[i+1].Text))
			result.WriteString("\n>>>>>>> Target Branch\n")
			i++
		}
	}
	return result.String()
}

// CreateConflictResolution creates a new conflict resolution session
func CreateConflictResolution() *ConflictResolution {
	return &ConflictResolution{
		Conflicts:    []ConflictFile{},
		Resolved:     []string{},
		IsMergeState: false,
	}
}

// CreateMergeConflictResolution creates a new conflict resolution session for merge
func CreateMergeConflictResolution(parent, otherParent, message string) *ConflictResolution {
	return &ConflictResolution{
		Parent:       parent,
		OtherParent:  otherParent,
		Message:      message,
		Conflicts:    []ConflictFile{},
		Resolved:     []string{},
		IsMergeState: true,
	}
}

// AddConflict adds a file to the conflict list
func (cr *ConflictResolution) AddConflict(filePath, currentHash, targetHash, ancestorHash string, content string) {
	conflict := ConflictFile{
		FilePath:     filePath,
		CurrentHash:  currentHash,
		TargetHash:   targetHash,
		AncestorHash: ancestorHash,
		Content:      content,
		Status:       "conflict",
	}
	cr.Conflicts = append(cr.Conflicts, conflict)
}

// MarkResolved marks a file as resolved
func (cr *ConflictResolution) MarkResolved(filePath string) {
	for i, conflict := range cr.Conflicts {
		if conflict.FilePath == filePath {
			cr.Conflicts[i].Status = "resolved"
			cr.Resolved = append(cr.Resolved, filePath)
			break
		}
	}
}

// HasUnresolvedConflicts checks if there are unresolved conflicts
func (cr *ConflictResolution) HasUnresolvedConflicts() bool {
	for _, conflict := range cr.Conflicts {
		if conflict.Status == "conflict" {
			return true
		}
	}
	return false
}

// GetUnresolvedConflicts returns list of unresolved conflict files
func (cr *ConflictResolution) GetUnresolvedConflicts() []ConflictFile {
	var unresolved []ConflictFile
	for _, conflict := range cr.Conflicts {
		if conflict.Status == "conflict" {
			unresolved = append(unresolved, conflict)
		}
	}
	return unresolved
}

// SaveConflictResolution saves conflict resolution state
func (cr *ConflictResolution) SaveConflictResolution() error {
	conflictPath := filepath.Join(".hit", "conflicts.json")
	data, err := storage.MarshalIndent(cr, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal conflict resolution: %v", err)
	}

	err = os.WriteFile(conflictPath, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to save conflict resolution: %v", err)
	}

	return nil
}

// LoadConflictResolution loads conflict resolution state
func LoadConflictResolution() (*ConflictResolution, error) {
	conflictPath := filepath.Join(".hit", "conflicts.json")
	_, err := os.Stat(conflictPath)
	if os.IsNotExist(err) {
		return nil, nil
	}

	data, err := os.ReadFile(conflictPath)
	if err != nil {
		return nil, err
	}

	var cr ConflictResolution
	err = storage.Unmarshal(data, &cr)
	if err != nil {
		return nil, err
	}

	return &cr, nil
}

// ClearConflictResolution removes conflict resolution state
func ClearConflictResolution() error {
	conflictPath := filepath.Join(".hit", "conflicts.json")
	return os.Remove(conflictPath)
}

// IsInMergeState checks if we're currently in a merge conflict state
func IsInMergeState() bool {
	cr, err := LoadConflictResolution()
	if err != nil || cr == nil {
		return false
	}
	return cr.IsMergeState
}

// GetMergeParents returns the parent and otherParent from conflict resolution
func GetMergeParents() (string, string, error) {
	cr, err := LoadConflictResolution()
	if err != nil || cr == nil {
		return "", "", err
	}

	if !cr.IsMergeState {
		return "", "", fmt.Errorf("not in merge state")
	}

	return cr.Parent, cr.OtherParent, nil
}

// CheckFileForConflicts checks if a specific file has unresolved conflicts
func CheckFileForConflicts(filePath string) bool {
	cr, err := LoadConflictResolution()
	if err != nil || cr == nil {
		return false
	}

	for _, conflict := range cr.Conflicts {
		if conflict.FilePath == filePath && conflict.Status == "conflict" {
			return true
		}
	}

	return false
}
