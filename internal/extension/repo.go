package extension

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
)

func HandleCommitTreeCommand(commandParts []string) go_types.Output {
	if len(commandParts) == 0 {
		return go_types.Output{
			Success: false,
			Message: "commit hash is required",
		}
	}

	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to find repo root: %v", err),
		}
	}

	commitHash := commandParts[0]
	commitTree, err := storage.GetCommitTree(commitHash)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to get commit tree: %v", err),
		}
	}

	indexPath := filepath.Join(".hit", "index.json")
	indexData, err := os.ReadFile(indexPath)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to read index: %v", err),
		}
	}

	var index go_types.Index
	if err := storage.Unmarshal(indexData, &index); err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to parse index: %v", err),
		}
	}

	workspaceEntries, err := buildWorkspaceSnapshot(repoRoot)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to snapshot workspace: %v", err),
		}
	}

	staged := computeDiff(commitTree.Entries, index.Entries, true, repoRoot)

	preEntries := index.Entries
	if len(staged) == 0 {
		preEntries = commitTree.Entries
	}

	unstaged := computeDiff(preEntries, workspaceEntries, false, repoRoot)

	result := map[string]map[string]go_types.FileStatus{
		"staged":   make(map[string]go_types.FileStatus),
		"unstaged": make(map[string]go_types.FileStatus),
	}

	for _, fs := range staged {
		result["staged"][fs.RelativePath] = fs
	}
	for _, fs := range unstaged {
		result["unstaged"][fs.RelativePath] = fs
	}

	return go_types.Output{
		Success: true,
		Data:    result,
		Message: "Computed staged and unstaged changes",
	}
}

func buildWorkspaceSnapshot(repoRoot string) (map[string]string, error) {
	snapshot := make(map[string]string)

	ignoreMatcher, err := storage.NewIgnoreMatcher(repoRoot)
	if err != nil {
		return nil, err
	}

	err = filepath.WalkDir(repoRoot, func(p string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relPath, err := filepath.Rel(repoRoot, p)
		if err != nil {
			return err
		}

		if relPath == ".hit" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if len(relPath) > 4 && relPath[:4] == ".hit" && relPath != ".hitignore" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		normRel := filepath.ToSlash(relPath)

		if d.IsDir() {
			if ignoreMatcher.ShouldIgnore(normRel, true) {
				return filepath.SkipDir
			}
			return nil
		}

		if ignoreMatcher.ShouldIgnore(normRel, false) {
			return nil
		}

		data, err := os.ReadFile(p)
		if err != nil {
			return nil
		}
		snapshot[normRel] = storage.Hash(data)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return snapshot, nil
}

func computeDiff(fromSet, toSet map[string]string, isStaged bool, repoRoot string) []go_types.FileStatus {
	results := make([]go_types.FileStatus, 0)

	visited := make(map[string]struct{})

	for path, fromHash := range fromSet {
		toHash, exists := toSet[path]
		if !exists {
			results = append(results, go_types.FileStatus{
				Path:          filepath.Join(repoRoot, filepath.FromSlash(path)),
				RelativePath:  path,
				Status:        "D",
				Staged:        isStaged,
				WorkspacePath: repoRoot,
			})
			continue
		}
		visited[path] = struct{}{}
		if fromHash != toHash {
			results = append(results, go_types.FileStatus{
				Path:          filepath.Join(repoRoot, filepath.FromSlash(path)),
				RelativePath:  path,
				Status:        "M",
				Staged:        isStaged,
				WorkspacePath: repoRoot,
			})
		}
	}

	for path := range toSet {
		if _, seen := visited[path]; seen {
			continue
		}
		if _, exists := fromSet[path]; !exists {
			results = append(results, go_types.FileStatus{
				Path:          filepath.Join(repoRoot, filepath.FromSlash(path)),
				RelativePath:  path,
				Status:        "A",
				Staged:        isStaged,
				WorkspacePath: repoRoot,
			})
		}
	}

	return results
}

func HandleStatusCommand() go_types.Output {
	_, err := storage.FindRepoRoot()
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: err.Error(),
		}
	}

	indexPath := filepath.Join(".hit", "index.json")
	indexData, err := os.ReadFile(indexPath)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to read index: %v", err),
		}
	}

	var index go_types.Index
	err = storage.Unmarshal(indexData, &index)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to parse index: %v", err),
		}
	}

	currentBranch, err := storage.GetBranch()
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to get current branch: %v", err),
		}
	}

	statusData := map[string]interface{}{
		"branch":      currentBranch,
		"stagedFiles": make([]string, 0),
		"hasStaged":   len(index.Entries) > 0,
		"hasUnstaged": false,
	}

	for filePath := range index.Entries {
		statusData["stagedFiles"] = append(statusData["stagedFiles"].([]string), filePath)
	}

	return go_types.Output{
		Success: true,
		Data:    statusData,
		Message: "Status retrieved successfully",
	}
}

func HandleDiffContentCommand(commandParts []string) go_types.Output {
	if len(commandParts) < 2 {
		return go_types.Output{Success: false, Message: "usage: diff-content <mode> <relPath>"}
	}
	mode := commandParts[0]
	relPath := strings.Join(commandParts[1:], " ")

	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return go_types.Output{Success: false, Message: fmt.Sprintf("failed to find repo root: %v", err)}
	}

	// Normalize relPath to forward slashes
	rel := filepath.ToSlash(relPath)

	headContent, headOk, err := getHeadContent(rel)
	if err != nil {
		return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read HEAD content: %v", err)}
	}

	left := ""
	right := ""
	leftLabel := ""
	rightLabel := ""

	switch mode {
	case "unstaged":
		idxContent, _, err := getIndexContent(rel)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read INDEX content: %v", err)}
		}
		left = idxContent
		leftLabel = "INDEX"
		wsBytes, _ := os.ReadFile(filepath.Join(repoRoot, filepath.FromSlash(rel)))
		right = string(wsBytes)
		rightLabel = "WORKSPACE"
	case "staged":
		if headOk {
			left = headContent
		}
		leftLabel = "HEAD"
		idxContent, _, err := getIndexContent(rel)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read INDEX content: %v", err)}
		}
		right = idxContent
		rightLabel = "INDEX"
	default:
		return go_types.Output{Success: false, Message: fmt.Sprintf("unknown mode: %s", mode)}
	}

	data := map[string]string{
		"left":       left,
		"right":      right,
		"leftLabel":  leftLabel,
		"rightLabel": rightLabel,
		"relPath":    rel,
	}

	return go_types.Output{Success: true, Data: data, Message: "diff content"}
}

// HandleBranchesCommand returns the list of local branches and the current branch
func HandleBranchesCommand() go_types.Output {
	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return go_types.Output{Success: false, Message: fmt.Sprintf("failed to find repo root: %v", err)}
	}

	current, err := storage.GetBranch()
	if err != nil {
		return go_types.Output{Success: false, Message: fmt.Sprintf("failed to get current branch: %v", err)}
	}

	headsDir := filepath.Join(repoRoot, ".hit", "refs", "heads")
	branches := make([]string, 0)

	// Walk headsDir recursively to support nested branch names (e.g., feature/x)
	_ = filepath.WalkDir(headsDir, func(p string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(headsDir, p)
		if err != nil {
			return nil
		}
		// Normalize to forward slashes
		branches = append(branches, filepath.ToSlash(rel))
		return nil
	})

	data := map[string]any{
		"branches": branches,
		"current":  current,
	}

	return go_types.Output{Success: true, Data: data, Message: "branches listed"}
}

func getHeadContent(relPath string) (string, bool, error) {
	tree, err := storage.GetHeadTree()
	if err != nil {
		return "", false, err
	}
	hash, ok := tree.Entries[relPath]
	if !ok || hash == "" {
		return "", false, nil
	}
	content, err := storage.LoadObject(hash)
	if err != nil {
		return "", false, err
	}
	return content, true, nil
}

func getIndexContent(relPath string) (string, bool, error) {
	indexPath := filepath.Join(".hit", "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return "", false, err
	}
	var index go_types.Index
	if err := storage.Unmarshal(data, &index); err != nil {
		return "", false, err
	}
	hash, ok := index.Entries[relPath]
	if !ok || hash == "" {
		return "", false, nil
	}
	content, err := storage.LoadObject(hash)
	if err != nil {
		return "", false, err
	}
	return content, true, nil
}
