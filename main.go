package main

import (
	"github.com/airbornharsh/hit/cmd"
)

var version = "dev"

func init() {
	cmd.Version = version
}

func main() {
	cmd.Execute()
}
