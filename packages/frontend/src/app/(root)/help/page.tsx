'use client'

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Help & Getting Started</h1>
        <p className="text-muted-foreground mt-2">
          Hit is a lightweight, Git-inspired version control system. This page
          covers installation, basic CLI usage, links to the website and the VS
          Code extension.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Installation</h2>
        <div>
          <h3 className="font-medium">macOS (Homebrew)</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`brew tap airbornharsh/hit
brew install hit`}</code>
          </pre>
        </div>
        <div>
          <h3 className="font-medium">Linux/macOS (Install Script)</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`curl -fsSL https://raw.githubusercontent.com/Airbornharsh/hit/main/scripts/install.sh | bash`}</code>
          </pre>
        </div>
        <div>
          <h3 className="font-medium">Manual</h3>
          <ol className="ml-6 list-decimal space-y-1">
            <li>
              Download binaries from{' '}
              <a
                href="https://github.com/Airbornharsh/hit/releases"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Releases
              </a>
            </li>
            <li>Make it executable and add to PATH:</li>
          </ol>
          <pre className="bg-muted mt-2 overflow-auto rounded-md p-3">
            <code>{`chmod +x ./hit && sudo mv ./hit /usr/local/bin/hit
hit version`}</code>
          </pre>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Quick Start</h2>
        <div>
          <h3 className="font-medium">Initialize a repository</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`hit init`}</code>
          </pre>
        </div>
        <div>
          <h3 className="font-medium">Stage and commit</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`hit add .
hit commit -m "Initial commit"`}</code>
          </pre>
        </div>
        <div>
          <h3 className="font-medium">Add a remote and push</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`hit remote add origin "hit@hithub.com:<username>/<repo>.hit"
hit push -u origin <branch>`}</code>
          </pre>
        </div>
        <div>
          <h3 className="font-medium">Clone a repository</h3>
          <pre className="bg-muted overflow-auto rounded-md p-3">
            <code>{`hit clone "hit@hithub.com:<username>/<repo>.hit"`}</code>
          </pre>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">VS Code Extension</h2>
        <p>
          Install from the Marketplace:{' '}
          <a
            href="https://marketplace.visualstudio.com/items?itemName=AirbornHarsh.hit"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            AirbornHarsh.hit
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Website</h2>
        <p>
          Browse repositories and commits on the web UI:{' '}
          <a
            href="https://hit.harshkeshri.com"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            https://hit.harshkeshri.com
          </a>
        </p>
      </section>
    </div>
  )
}
