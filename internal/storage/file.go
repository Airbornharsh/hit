package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"
)

func GetDifference(fileHash1 string, fileHash2 string) string {
	file1, err := LoadObject(fileHash1)
	if err != nil {
		file1 = ""
	}

	file2, err := LoadObject(fileHash2)
	if err != nil {
		file2 = ""
	}

	if file1 == file2 {
		return ""
	}

	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(file1, file2, false)
	diffs = dmp.DiffCleanupSemantic(diffs)

	return formatColoredLineDiff(diffs)
}

func formatColoredLineDiff(diffs []diffmatchpatch.Diff) string {
	if len(diffs) == 0 {
		return ""
	}

	// ANSI colors
	const (
		reset  = "\x1b[0m"
		red    = "\x1b[31m"
		green  = "\x1b[32m"
		yellow = "\x1b[33m"
		blue   = "\x1b[34m"
	)

	var b strings.Builder

	lineNum1 := 1
	lineNum2 := 1

	wroteAny := false
	contextLines := 2

	type lineInfo struct {
		content    string
		lineNum    int
		changeType diffmatchpatch.Operation
	}

	var allLines []lineInfo

	for _, d := range diffs {
		lines := strings.Split(d.Text, "\n")
		for i, line := range lines {
			isLastEmpty := i == len(lines)-1 && line == ""
			if isLastEmpty {
				continue
			}

			switch d.Type {
			case diffmatchpatch.DiffEqual:
				allLines = append(allLines, lineInfo{line, lineNum1, d.Type})
				lineNum1++
				lineNum2++
			case diffmatchpatch.DiffDelete:
				allLines = append(allLines, lineInfo{line, lineNum1, d.Type})
				lineNum1++
			case diffmatchpatch.DiffInsert:
				allLines = append(allLines, lineInfo{line, lineNum2, d.Type})
				lineNum2++
			}
		}
	}

	for i, line := range allLines {
		shouldShow := false

		if line.changeType == diffmatchpatch.DiffDelete || line.changeType == diffmatchpatch.DiffInsert {
			shouldShow = true
		} else {
			for j := max(0, i-contextLines); j <= min(len(allLines)-1, i+contextLines); j++ {
				if allLines[j].changeType == diffmatchpatch.DiffDelete || allLines[j].changeType == diffmatchpatch.DiffInsert {
					shouldShow = true
					break
				}
			}
		}

		if !shouldShow {
			continue
		}

		if i > 0 && allLines[i-1].changeType == diffmatchpatch.DiffEqual &&
			(line.changeType == diffmatchpatch.DiffDelete || line.changeType == diffmatchpatch.DiffInsert) {
			fmt.Fprintf(&b, "%s---%s\n", blue, reset)
		}

		switch line.changeType {
		case diffmatchpatch.DiffEqual:
			fmt.Fprintf(&b, " %d: %s\n", line.lineNum, line.content)
		case diffmatchpatch.DiffDelete:
			fmt.Fprintf(&b, "%s-%d: %s%s\n", red, line.lineNum, line.content, reset)
			wroteAny = true
		case diffmatchpatch.DiffInsert:
			fmt.Fprintf(&b, "%s+%d: %s%s\n", green, line.lineNum, line.content, reset)
			wroteAny = true
		}
	}

	if !wroteAny {
		return ""
	}
	return b.String()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func CollectAllFiles(rootDir string) map[string]bool {
	existingFiles := make(map[string]bool)

	ignoreMatcher, err := GetIgnoreMatcher()
	if err != nil {
		repoRoot, err := FindRepoRoot()
		if err != nil {
			return existingFiles
		}
		ignoreMatcher, err = NewIgnoreMatcher(repoRoot)
		if err != nil {
			return existingFiles
		}
	}

	var collectFiles func(dir string)
	collectFiles = func(dir string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}

		for _, entry := range entries {
			path := filepath.Join(dir, entry.Name())

			if strings.HasSuffix(path, ".hit") {
				continue
			}

			relPath, err := filepath.Rel(rootDir, path)
			if err != nil {
				continue
			}
			relPath = filepath.ToSlash(relPath)

			if ignoreMatcher.ShouldIgnore(relPath, entry.IsDir()) {
				continue
			}

			if entry.IsDir() {
				collectFiles(path)
			} else {
				existingFiles[path] = true
			}
		}
	}

	collectFiles(rootDir)
	return existingFiles
}
