package storage

import (
	"crypto/sha1"
	"fmt"
)

// Hash returns SHA1 hash of content
func Hash(content []byte) string {
	h := sha1.New()
	h.Write(content)
	return fmt.Sprintf("%x", h.Sum(nil))
}
