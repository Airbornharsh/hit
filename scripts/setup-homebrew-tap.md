# Setting Up Homebrew Tap for Hit

## Steps to Create Homebrew Tap

1. **Create a new repository** on GitHub:
   - Repository name: `homebrew-hit`
   - Make it public
   - Initialize with a README

2. **Create the formula file** `hit.rb` in the repository root:

```ruby
class Hit < Formula
  desc "A fast, minimal version control system"
  homepage "https://github.com/Airbornharsh/hit"
  url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-amd64.tar.gz"
  sha256 "YOUR_SHA256_HERE"  # Get from: shasum -a 256 hit-0.0.1-darwin-amd64.tar.gz
  license "MIT"
  version "0.0.1"

  if Hardware::CPU.intel?
    url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-amd64.tar.gz"
    sha256 "SHA256_FOR_INTEL"
  elsif Hardware::CPU.arm?
    url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-arm64.tar.gz"
    sha256 "SHA256_FOR_ARM"
  end

  def install
    bin.install "hit"
  end

  test do
    system "#{bin}/hit", "version"
  end
end
```

3. **Get SHA256 hashes**:
   ```bash
   shasum -a 256 hit-0.0.1-darwin-amd64.tar.gz
   shasum -a 256 hit-0.0.1-darwin-arm64.tar.gz
   ```

4. **Users can now install with**:
   ```bash
   brew tap airbornharsh/hit
   brew install hit
   ```

5. **To update formula for new version**:
   - Update the URL and sha256 in `hit.rb`
   - Commit and push changes

## Alternative: Single Formula with Platform Detection

```ruby
class Hit < Formula
  desc "A fast, minimal version control system"
  homepage "https://github.com/Airbornharsh/hit"
  license "MIT"

  if OS.mac? && Hardware::CPU.intel?
    url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-amd64.tar.gz"
    sha256 "INTEL_SHA256"
  elsif OS.mac? && Hardware::CPU.arm?
    url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-arm64.tar.gz"
    sha256 "ARM_SHA256"
  end

  def install
    bin.install "hit"
  end

  test do
    system "#{bin}/hit", "version"
  end
end
```

