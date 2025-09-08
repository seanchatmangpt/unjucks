// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="preface.html">Preface</a></li><li class="chapter-item expanded affix "><a href="introduction.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><li class="part-title">Part I: Foundations</li><li class="chapter-item expanded "><a href="ch01-introduction.html"><strong aria-hidden="true">1.</strong> Chapter 1: Introduction - Code Generation in 2026</a></li><li class="chapter-item expanded "><a href="ch02-fundamentals.html"><strong aria-hidden="true">2.</strong> Chapter 2: Fundamentals - Core Principles and Patterns</a></li><li class="chapter-item expanded "><a href="ch03-template-design.html"><strong aria-hidden="true">3.</strong> Chapter 3: Template Design - Modern Template Architecture</a></li><li class="chapter-item expanded affix "><li class="part-title">Part II: Configuration and Implementation</li><li class="chapter-item expanded "><a href="ch04-configuration.html"><strong aria-hidden="true">4.</strong> Chapter 4: Configuration - Project Setup and Customization</a></li><li class="chapter-item expanded "><a href="ch05-testing.html"><strong aria-hidden="true">5.</strong> Chapter 5: Testing - Quality Assurance and Validation</a></li><li class="chapter-item expanded "><a href="ch06-deployment.html"><strong aria-hidden="true">6.</strong> Chapter 6: Deployment - Production Strategies</a></li><li class="chapter-item expanded affix "><li class="part-title">Part III: Advanced Topics</li><li class="chapter-item expanded "><a href="ch07-mcp-patterns.html"><strong aria-hidden="true">7.</strong> Chapter 7: MCP Patterns - Integration and Orchestration</a></li><li class="chapter-item expanded "><a href="ch08-semantic-web.html"><strong aria-hidden="true">8.</strong> Chapter 8: Semantic Web - Structured Data and Ontologies</a></li><li class="chapter-item expanded "><a href="ch09-advanced-workflows.html"><strong aria-hidden="true">9.</strong> Chapter 9: Advanced Workflows - Multi-Agent Development</a></li><li class="chapter-item expanded affix "><li class="part-title">Part IV: Metrics and Performance Analysis</li><li class="chapter-item expanded "><a href="part6/chapter19-context-engineering-metrics.html"><strong aria-hidden="true">10.</strong> Chapter 19: Context Engineering Success Metrics</a></li><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><li class="part-title">Reference Material</li><li class="chapter-item expanded "><a href="core/cli.html"><strong aria-hidden="true">11.</strong> CLI Commands</a></li><li class="chapter-item expanded "><a href="core/templates.html"><strong aria-hidden="true">12.</strong> Template Syntax</a></li><li class="chapter-item expanded "><a href="core/file-operations.html"><strong aria-hidden="true">13.</strong> File Operations</a></li><li class="chapter-item expanded "><a href="core/variables.html"><strong aria-hidden="true">14.</strong> Variables and Context</a></li><li class="chapter-item expanded "><a href="advanced/semantic/integration.html"><strong aria-hidden="true">15.</strong> Semantic Integration</a></li><li class="chapter-item expanded "><a href="advanced/semantic/rdf-processing.html"><strong aria-hidden="true">16.</strong> RDF Processing</a></li><li class="chapter-item expanded "><a href="advanced/semantic/filters.html"><strong aria-hidden="true">17.</strong> Custom Filters</a></li><li class="chapter-item expanded "><a href="advanced/semantic/enterprise-ontologies.html"><strong aria-hidden="true">18.</strong> Enterprise Ontologies</a></li><li class="chapter-item expanded "><a href="enterprise/patterns/fortune-5.html"><strong aria-hidden="true">19.</strong> Fortune 500 Case Studies</a></li><li class="chapter-item expanded "><a href="enterprise/security/architecture.html"><strong aria-hidden="true">20.</strong> Security Architecture</a></li><li class="chapter-item expanded "><a href="enterprise/deployment/overview.html"><strong aria-hidden="true">21.</strong> Deployment Overview</a></li><li class="chapter-item expanded "><a href="docs/context-engineering-metrics-case-study.html"><strong aria-hidden="true">22.</strong> Complete Context Engineering Metrics &amp; ROI Analysis</a></li><li class="chapter-item expanded "><a href="docs/context-engineering-narrative-thread.html"><strong aria-hidden="true">23.</strong> Context Engineering Narrative Thread: The Unjucks v2 Story</a></li><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><li class="part-title">Appendices</li><li class="chapter-item expanded "><a href="appendices/glossary.html"><strong aria-hidden="true">24.</strong> Glossary</a></li><li class="chapter-item expanded "><a href="appendices/configuration-reference.html"><strong aria-hidden="true">25.</strong> Configuration Reference</a></li><li class="chapter-item expanded "><a href="appendices/troubleshooting.html"><strong aria-hidden="true">26.</strong> Troubleshooting Guide</a></li><li class="chapter-item expanded "><a href="appendices/migration.html"><strong aria-hidden="true">27.</strong> Migration Guide</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
