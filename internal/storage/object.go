package storage

import (
	"compress/zlib"
	"io"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/utils"
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

func LoadObject(hash string) (string, error) {
	rootPath, err := utils.FindRepoRoot()
	if err != nil {
		return "", err
	}

	segment := hash[0:2]
	fileName := hash[2:]

	filePath := filepath.Join(rootPath, ".hit", "objects", segment, fileName)

	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Create zlib reader directly from the file
	reader, err := zlib.NewReader(file)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	// Read and decompress the content
	decompressed, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(decompressed), nil
}
