class Unjucks < Formula
  desc "Semantic-aware scaffolding with RDF/Turtle support"
  homepage "https://github.com/unjucks/unjucks"
  url "https://registry.npmjs.org/unjucks/-/unjucks-1.0.0.tgz"
  sha256 "" # Will be calculated automatically by Homebrew
  license "MIT"

  # Bottle configurations for different architectures
  bottle do
    sha256 cellar: :any_skip_relocation, arm64_sonoma:   ""
    sha256 cellar: :any_skip_relocation, arm64_ventura:  ""
    sha256 cellar: :any_skip_relocation, arm64_monterey: ""
    sha256 cellar: :any_skip_relocation, sonoma:         ""
    sha256 cellar: :any_skip_relocation, ventura:        ""
    sha256 cellar: :any_skip_relocation, monterey:       ""
    sha256 cellar: :any_skip_relocation, x86_64_linux:   ""
  end

  # Node.js dependency
  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]

    # Generate shell completions if available
    if (libexec/"bin/unjucks.cjs").exist?
      # Future: Add completion generation
      # system libexec/"bin/unjucks.cjs", "completion", "bash", out: "#{bash_completion}/unjucks"
      # system libexec/"bin/unjucks.cjs", "completion", "zsh", out: "#{zsh_completion}/_unjucks"
      # system libexec/"bin/unjucks.cjs", "completion", "fish", out: "#{fish_completion}/unjucks.fish"
    end
  end

  test do
    # Test basic functionality
    system "#{bin}/unjucks", "--version"
    assert_match(/\d+\.\d+\.\d+/, shell_output("#{bin}/unjucks --version"))
    
    # Test list command
    output = shell_output("#{bin}/unjucks list")
    assert_match "Available generators", output
    assert_match "component", output
    assert_match "api", output
    assert_match "service", output
    
    # Test help command
    help_output = shell_output("#{bin}/unjucks --help")
    assert_match "Usage:", help_output
    assert_match "Commands:", help_output
    assert_match "generate", help_output
    
    # Test init command in a temporary directory
    system "mkdir", "-p", "test_project"
    Dir.chdir("test_project") do
      init_output = shell_output("#{bin}/unjucks init")
      assert_match "Initializing Unjucks templates", init_output
    end
    
    # Test dry run generation
    dry_run_output = shell_output("#{bin}/unjucks generate component react --dry")
    assert_match "Dry run", dry_run_output
    assert_match "Would generate", dry_run_output
    
    # Performance test - CLI should start quickly
    start_time = Time.now
    system "#{bin}/unjucks", "--version"
    duration = Time.now - start_time
    assert duration < 2, "CLI startup took too long: #{duration}s"
    
    # Test that binary is properly linked and executable
    assert_predicate bin/"unjucks", :exist?
    assert_predicate bin/"unjucks", :executable?
  end
end