package storage

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type IgnoreRule struct {
	Pattern string
	IsDir   bool
	Negate  bool
}

type IgnoreMatcher struct {
	rules []IgnoreRule
}

func NewIgnoreMatcher(repoRoot string) (*IgnoreMatcher, error) {
	matcher := &IgnoreMatcher{
		rules: make([]IgnoreRule, 0),
	}

	hitignorePath := filepath.Join(repoRoot, ".hitignore")
	if err := matcher.loadIgnoreFile(hitignorePath); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	return matcher, nil
}

func (im *IgnoreMatcher) loadIgnoreFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		rule := im.parseIgnoreRule(line)
		im.rules = append(im.rules, rule)
	}

	return scanner.Err()
}

func (im *IgnoreMatcher) parseIgnoreRule(pattern string) IgnoreRule {
	rule := IgnoreRule{
		Pattern: pattern,
		IsDir:   false,
		Negate:  false,
	}

	if strings.HasPrefix(pattern, "!") {
		rule.Negate = true
		rule.Pattern = pattern[1:]
	}

	if strings.HasSuffix(pattern, "/") {
		rule.IsDir = true
		rule.Pattern = strings.TrimSuffix(rule.Pattern, "/")
	}

	return rule
}

func (im *IgnoreMatcher) ShouldIgnore(filePath string, isDir bool) bool {
	normalizedPath := filepath.ToSlash(filePath)

	ignored := false
	negated := false

	for _, rule := range im.rules {
		if im.matchesRule(normalizedPath, isDir, rule) {
			if rule.Negate {
				negated = true
			} else {
				ignored = true
			}
		}
	}

	if negated {
		return false
	}

	return ignored
}

func (im *IgnoreMatcher) matchesRule(filePath string, isDir bool, rule IgnoreRule) bool {
	pattern := rule.Pattern

	if strings.HasPrefix(pattern, "/") {
		pattern = pattern[1:]
		return im.matchesPattern(filePath, pattern)
	}

	if strings.HasSuffix(pattern, "/") {
		pattern = strings.TrimSuffix(pattern, "/")
		if strings.HasPrefix(filePath, pattern+"/") || filePath == pattern {
			return true
		}
		pathParts := strings.Split(filePath, "/")
		for i := range pathParts {
			subPath := strings.Join(pathParts[:i+1], "/")
			if subPath == pattern {
				return true
			}
		}
		return false
	}

	if rule.IsDir {
		pathParts := strings.Split(filePath, "/")
		for i := range pathParts {
			parentDir := strings.Join(pathParts[:i+1], "/")
			if parentDir == pattern {
				return true
			}
		}
	}

	pathParts := strings.Split(filePath, "/")
	for i := range pathParts {
		subPath := strings.Join(pathParts[i:], "/")
		if im.matchesPattern(subPath, pattern) {
			return true
		}
	}

	return false
}

func (im *IgnoreMatcher) matchesPattern(filePath, pattern string) bool {
	pattern = strings.ReplaceAll(pattern, "**", "{{RECURSIVE}}")

	if strings.Contains(pattern, "{{RECURSIVE}}") {
		return im.matchesRecursivePattern(filePath, pattern)
	}

	return im.matchesSimplePattern(filePath, pattern)
}

func (im *IgnoreMatcher) matchesRecursivePattern(filePath, pattern string) bool {
	parts := strings.Split(pattern, "{{RECURSIVE}}")

	if len(parts) == 1 {
		return im.matchesSimplePattern(filePath, pattern)
	}

	if len(parts) == 2 {
		prefix := parts[0]
		suffix := parts[1]

		prefix = strings.TrimSuffix(prefix, "/")

		if prefix != "" && !strings.HasPrefix(filePath, prefix+"/") && filePath != prefix {
			return false
		}

		if suffix != "" && !strings.HasSuffix(filePath, "/"+suffix) && filePath != suffix {
			return false
		}

		return true
	}

	return strings.Contains(filePath, strings.ReplaceAll(pattern, "{{RECURSIVE}}", ""))
}

func (im *IgnoreMatcher) matchesSimplePattern(filePath, pattern string) bool {
	if filePath == pattern {
		return true
	}

	if !strings.Contains(pattern, "*") {
		return filePath == pattern
	}

	return im.matchesWildcard(filePath, pattern)
}

func (im *IgnoreMatcher) matchesWildcard(filePath, pattern string) bool {
	if strings.HasPrefix(pattern, "*") && !strings.Contains(pattern[1:], "*") {
		suffix := pattern[1:]
		return strings.HasSuffix(filePath, suffix)
	}

	if strings.HasSuffix(pattern, "*") && !strings.Contains(pattern[:len(pattern)-1], "*") {
		prefix := pattern[:len(pattern)-1]
		return strings.HasPrefix(filePath, prefix)
	}

	parts := strings.Split(pattern, "*")
	if len(parts) == 2 {
		prefix := parts[0]
		suffix := parts[1]
		return strings.HasPrefix(filePath, prefix) && strings.HasSuffix(filePath, suffix)
	}

	return strings.Contains(filePath, strings.ReplaceAll(pattern, "*", ""))
}

func GetIgnoreMatcher() (*IgnoreMatcher, error) {
	repoRoot, err := FindRepoRoot()
	if err != nil {
		return nil, err
	}

	return NewIgnoreMatcher(repoRoot)
}

func (im *IgnoreMatcher) DebugRules() {
	for i, rule := range im.rules {
		fmt.Printf("  %d: Pattern='%s', IsDir=%v, Negate=%v\n", i, rule.Pattern, rule.IsDir, rule.Negate)
	}
}
