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

	left := ""
	right := ""
	leftLabel := ""
	rightLabel := ""

	switch mode {
	case "unstaged":
		_, _, err := getHeadContent(rel)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read HEAD content: %v", err)}
		}

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
		headContent, headOk, err := getHeadContent(rel)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read HEAD content: %v", err)}
		}

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
	case "commit":
		if len(commandParts) < 3 {
			return go_types.Output{Success: false, Message: "usage: diff-content commit <relPath> <commitHash>"}
		}
		commitHash := commandParts[len(commandParts)-1]
		relCommit := filepath.ToSlash(strings.Join(commandParts[1:len(commandParts)-1], " "))

		commitTree, err := storage.GetCommitTree(commitHash)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to get commit tree: %v", err)}
		}

		parentHash := commitTree.Parent
		var parentTree *go_types.Tree
		if parentHash != "" {
			parentTree, err = storage.GetCommitTree(parentHash)
			if err != nil {
				return go_types.Output{Success: false, Message: fmt.Sprintf("failed to get parent commit tree: %v", err)}
			}
		}

		rightBlob := ""
		if h, ok := commitTree.Entries[relCommit]; ok {
			rightBlob = h
		}
		leftBlob := ""
		if parentTree != nil {
			if h, ok := parentTree.Entries[relCommit]; ok {
				leftBlob = h
			}
		}

		rightContent, err := storage.GetFileContentFromHash(rightBlob)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read commit file content: %v", err)}
		}
		leftContent, err := storage.GetFileContentFromHash(leftBlob)
		if err != nil {
			return go_types.Output{Success: false, Message: fmt.Sprintf("failed to read parent file content: %v", err)}
		}

		left = leftContent
		right = rightContent
		if parentHash != "" {
			if len(parentHash) > 7 {
				leftLabel = parentHash[:7]
			} else {
				leftLabel = parentHash
			}
		} else {
			leftLabel = "Parent"
		}
		if len(commitHash) > 7 {
			rightLabel = commitHash[:7]
		} else {
			rightLabel = commitHash
		}
		rel = relCommit
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

func HandleGraphLogCommand() go_types.Output {
	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return go_types.Output{Success: false, Message: fmt.Sprintf("failed to find repo root: %v", err)}
	}

	headsDir := filepath.Join(repoRoot, ".hit", "refs", "heads")
	logsDir := filepath.Join(repoRoot, ".hit", "logs", "refs", "heads")

	type Node struct {
		Hash        string   `json:"hash"`
		Parents     []string `json:"parents"`
		OtherParent string   `json:"otherParent,omitempty"`
		Message     string   `json:"message"`
		Author      string   `json:"author"`
		Date        string   `json:"date"`
		Refs        []string `json:"refs"`
	}

	nodes := make(map[string]*Node)
	heads := make(map[string]string)

	_ = filepath.WalkDir(headsDir, func(p string, d os.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() {
			return nil
		}
		data, err := os.ReadFile(p)
		if err == nil {
			hash := strings.TrimSpace(string(data))
			if hash != "" {
				rel, _ := filepath.Rel(headsDir, p)
				bname := filepath.ToSlash(rel)
				heads[hash] = bname
				if nodes[hash] == nil {
					nodes[hash] = &Node{Hash: hash, Parents: []string{}, Refs: []string{}}
				}
			}
		}
		return nil
	})

	_ = filepath.WalkDir(logsDir, func(p string, d os.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(logsDir, p)
		if err != nil {
			return nil
		}
		bname := filepath.ToSlash(relPath)
		content, err := os.ReadFile(p)
		if err != nil {
			return nil
		}
		var arr []map[string]any
		if err := storage.Unmarshal(content, &arr); err != nil {
			return nil
		}
		var prevHash string
		for _, entry := range arr {
			h, _ := entry["hash"].(string)
			if h == "" {
				continue
			}
			msg, _ := entry["message"].(string)
			author, _ := entry["author"].(string)
			date, _ := entry["timestamp"].(string)

			parent, _ := entry["parent"].(string)
			otherParent, _ := entry["otherParent"].(string)

			var parents []string
			if parent != "" && parent != "0000000000000000000000000000000000000000" {
				parents = append(parents, parent)
			}
			if otherParent != "" && otherParent != "0000000000000000000000000000000000000000" {
				parents = append(parents, otherParent)
			}

			if len(parents) == 0 {
				if ps, ok := entry["parents"].([]any); ok {
					for _, v := range ps {
						if s, ok := v.(string); ok && s != "" && s != "0000000000000000000000000000000000000000" {
							parents = append(parents, s)
						}
					}
				}
			}

			if len(parents) == 0 && prevHash != "" {
				parents = []string{prevHash}
			}

			n := nodes[h]
			if n == nil {
				n = &Node{Hash: h}
			}
			if n.Message == "" {
				n.Message = msg
			}
			if n.Author == "" {
				n.Author = author
			}
			if n.Date == "" {
				n.Date = date
			}
			if len(n.Parents) == 0 && len(parents) > 0 {
				n.Parents = parents
			}
			if n.OtherParent == "" && otherParent != "" && otherParent != "0000000000000000000000000000000000000000" {
				n.OtherParent = otherParent
			}
			found := false
			for _, r := range n.Refs {
				if r == bname {
					found = true
					break
				}
			}
			if !found {
				n.Refs = append(n.Refs, bname)
			}
			nodes[h] = n
			prevHash = h
		}
		return nil
	})

	out := make([]Node, 0, len(nodes))
	for _, n := range nodes {
		out = append(out, *n)
	}

	currentBranch, _ := storage.GetBranch()

	data := map[string]any{
		"nodes":         out,
		"heads":         heads,
		"currentBranch": currentBranch,
	}
	return go_types.Output{Success: true, Data: data, Message: "graph built"}
}

func HandleCommitFilesCommand(commandParts []string) go_types.Output {
	if len(commandParts) == 0 {
		return go_types.Output{
			Success: false,
			Message: "commit hash is required",
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

	if commitTree.Parent == "" || commitTree.Parent == "0000000000000000000000000000000000000000" {
		files := make([]map[string]any, 0, len(commitTree.Entries))
		for fileName := range commitTree.Entries {
			files = append(files, map[string]any{
				"path":      fileName,
				"status":    "added",
				"additions": 0,
				"deletions": 0,
				"changes":   0,
			})
		}

		return go_types.Output{
			Success: true,
			Data: map[string]any{
				"files": files,
				"stats": map[string]int{
					"total":     len(files),
					"additions": 0,
					"deletions": 0,
				},
			},
			Message: "commit files retrieved",
		}
	}

	parentTree, err := storage.GetCommitTree(commitTree.Parent)
	if err != nil {
		return go_types.Output{
			Success: false,
			Message: fmt.Sprintf("failed to get parent commit tree: %v", err),
		}
	}

	files := make([]map[string]any, 0)

	currentFiles := make(map[string]bool)
	parentFiles := make(map[string]bool)

	for fileName := range commitTree.Entries {
		currentFiles[fileName] = true
	}

	for fileName := range parentTree.Entries {
		parentFiles[fileName] = true
	}

	for fileName := range currentFiles {
		if !parentFiles[fileName] {
			files = append(files, map[string]any{
				"path":      fileName,
				"status":    "added",
				"additions": 0,
				"deletions": 0,
				"changes":   0,
			})
		}
	}

	for fileName := range parentFiles {
		if !currentFiles[fileName] {
			files = append(files, map[string]any{
				"path":      fileName,
				"status":    "deleted",
				"additions": 0,
				"deletions": 0,
				"changes":   0,
			})
		}
	}

	for fileName, fileHash := range commitTree.Entries {
		if parentFiles[fileName] {
			parentFileHash := parentTree.Entries[fileName]
			if parentFileHash != fileHash {
				files = append(files, map[string]any{
					"path":      fileName,
					"status":    "modified",
					"additions": 0,
					"deletions": 0,
					"changes":   0,
				})
			}
		}
	}

	return go_types.Output{
		Success: true,
		Data: map[string]any{
			"files": files,
			"stats": map[string]int{
				"total":     len(files),
				"additions": 0,
				"deletions": 0,
			},
		},
		Message: "commit files retrieved",
	}
}
