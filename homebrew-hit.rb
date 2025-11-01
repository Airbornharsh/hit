# Homebrew formula for Hit
# To install: brew install --build-from-source ./homebrew-hit.rb
# Or add as tap: brew tap airbornharsh/hit https://github.com/Airbornharsh/hit

class Hit < Formula
  desc "A fast, minimal version control system"
  homepage "https://github.com/Airbornharsh/hit"
  url "https://github.com/Airbornharsh/hit/archive/refs/tags/v0.0.1.tar.gz"
  sha256 "" # Update this with actual sha256 when you have a release
  license "MIT"
  head "https://github.com/Airbornharsh/hit.git", branch: "main"

  depends_on "go" => :build

  def install
    system "go", "build", "-ldflags=-s -w", "-o", bin/"hit", "./main.go"
  end

  test do
    system "#{bin}/hit", "version"
  end
end

