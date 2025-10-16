package storage

import (
	"compress/zlib"
	"os"
	"path/filepath"
)

// WriteObject compresses and stores object in .hit/objects
func WriteObject(hash string, content []byte) error {
	dir := filepath.Join(".hit", "objects", hash[:2])
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	filePath := filepath.Join(dir, hash[2:])
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := zlib.NewWriter(file)
	defer writer.Close()

	_, err = writer.Write(content)
	if err != nil {
		return err
	}

	return nil
}
