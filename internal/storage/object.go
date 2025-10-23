package storage

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"io"
	"net/http"
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
	_, _, filePath, err := utils.HashInfo(hash)
	if err != nil {
		return "", err
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Create zlib reader directly from the file
	reader, err := zlib.NewReader(file)
	println(err)
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

func LoadObjectUrl(hash string) (string, error) {
	url := fmt.Sprintf("https://media.harshkeshri.com/hit/%s/%s", hash[:2], hash[2:])

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	reader, err := zlib.NewReader(bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(decompressed), nil
}

func LoadObjectUrlCompressed(hash string) (string, error) {
	url := fmt.Sprintf("https://media.harshkeshri.com/hit/%s/%s", hash[:2], hash[2:])

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func CheckHashUrlExists(hash string) (bool, string, error) {
	url := fmt.Sprintf("https://media.harshkeshri.com/hit/%s/%s", hash[:2], hash[2:])

	resp, err := http.Head(url)
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, url, nil
}
