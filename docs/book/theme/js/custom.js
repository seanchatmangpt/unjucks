// Unjucks 2026 - Custom JavaScript Enhancements

(function() {
    'use strict';

    // Theme and interaction enhancements
    const UnjucksBook = {
        // Initialize all features
        init() {
            this.setupThemeToggle();
            this.setupSearchEnhancements();
            this.setupCodeBlocks();
            this.setupInteractiveElements();
            this.setupNavigation();
            this.setupAccessibility();
            this.setupAnalytics();
        },

        // Theme toggle functionality
        setupThemeToggle() {
            const themeToggle = document.createElement('button');
            themeToggle.className = 'theme-toggle';
            themeToggle.setAttribute('aria-label', 'Toggle theme');
            themeToggle.innerHTML = '🌙';
            
            const toolbar = document.querySelector('.left-buttons') || document.querySelector('.right-buttons');
            if (toolbar) {
                toolbar.appendChild(themeToggle);
            }

            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.classList.contains('navy') ? 'navy' : 'light';
                const newTheme = currentTheme === 'light' ? 'navy' : 'light';
                
                document.documentElement.classList.remove(currentTheme);
                document.documentElement.classList.add(newTheme);
                
                themeToggle.innerHTML = newTheme === 'navy' ? '☀️' : '🌙';
                localStorage.setItem('unjucks-theme', newTheme);
            });

            // Load saved theme
            const savedTheme = localStorage.getItem('unjucks-theme');
            if (savedTheme) {
                document.documentElement.classList.add(savedTheme);
                themeToggle.innerHTML = savedTheme === 'navy' ? '☀️' : '🌙';
            }
        },

        // Enhanced search functionality
        setupSearchEnhancements() {
            const searchInput = document.getElementById('searchbar');
            if (!searchInput) return;

            // Add search shortcuts
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    searchInput.focus();
                }
                
                if (e.key === 'Escape' && document.activeElement === searchInput) {
                    searchInput.blur();
                }
            });

            // Search result highlighting
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.highlightSearchTerm(e.target.value);
                }, 300);
            });
        },

        // Highlight search terms in content
        highlightSearchTerm(term) {
            if (!term || term.length < 2) {
                this.clearHighlights();
                return;
            }

            const content = document.querySelector('.content');
            if (!content) return;

            // Remove existing highlights
            this.clearHighlights();

            // Add new highlights
            const walker = document.createTreeWalker(
                content,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.parentNode.tagName !== 'SCRIPT' && node.parentNode.tagName !== 'STYLE') {
                    textNodes.push(node);
                }
            }

            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const regex = new RegExp(`(${term})`, 'gi');
                if (regex.test(text)) {
                    const highlightedText = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                    const wrapper = document.createElement('span');
                    wrapper.innerHTML = highlightedText;
                    textNode.parentNode.replaceChild(wrapper, textNode);
                }
            });
        },

        // Clear search highlights
        clearHighlights() {
            const highlights = document.querySelectorAll('.search-highlight');
            highlights.forEach(highlight => {
                const parent = highlight.parentNode;
                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                parent.normalize();
            });
        },

        // Enhanced code blocks with copy functionality
        setupCodeBlocks() {
            const codeBlocks = document.querySelectorAll('pre code');
            codeBlocks.forEach(codeBlock => {
                const pre = codeBlock.parentNode;
                
                // Add copy button
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button';
                copyButton.innerHTML = '📋';
                copyButton.setAttribute('aria-label', 'Copy code');
                copyButton.title = 'Copy code';

                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(codeBlock.textContent);
                        copyButton.innerHTML = '✅';
                        copyButton.title = 'Copied!';
                        setTimeout(() => {
                            copyButton.innerHTML = '📋';
                            copyButton.title = 'Copy code';
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy:', err);
                        copyButton.innerHTML = '❌';
                        setTimeout(() => {
                            copyButton.innerHTML = '📋';
                        }, 2000);
                    }
                });

                // Wrap in container for positioning
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                wrapper.appendChild(copyButton);
            });

            // Add line numbers for long code blocks
            codeBlocks.forEach(codeBlock => {
                const lines = codeBlock.textContent.split('\n');
                if (lines.length > 10) {
                    codeBlock.parentNode.classList.add('line-numbers');
                }
            });
        },

        // Interactive elements and demos
        setupInteractiveElements() {
            // Handle interactive examples
            const examples = document.querySelectorAll('.interactive-example');
            examples.forEach(example => {
                const runButton = example.querySelector('.run-example');
                if (runButton) {
                    runButton.addEventListener('click', () => {
                        this.runInteractiveExample(example);
                    });
                }
            });

            // Collapsible sections
            const collapsibles = document.querySelectorAll('[data-collapsible]');
            collapsibles.forEach(element => {
                const trigger = element.querySelector('[data-toggle]');
                const content = element.querySelector('[data-content]');
                
                if (trigger && content) {
                    trigger.addEventListener('click', () => {
                        const isExpanded = element.getAttribute('aria-expanded') === 'true';
                        element.setAttribute('aria-expanded', !isExpanded);
                        content.style.display = isExpanded ? 'none' : 'block';
                    });
                }
            });
        },

        // Run interactive code examples
        runInteractiveExample(example) {
            const codeElement = example.querySelector('code');
            const outputElement = example.querySelector('.output') || this.createOutputElement(example);
            
            if (!codeElement) return;

            try {
                // This is a simplified example runner
                // In a real implementation, you'd want proper sandboxing
                const code = codeElement.textContent;
                
                // Basic JavaScript execution for demos
                if (example.dataset.language === 'javascript') {
                    const result = this.safeEval(code);
                    outputElement.textContent = result;
                }
            } catch (error) {
                outputElement.textContent = `Error: ${error.message}`;
                outputElement.className = 'output error';
            }
        },

        // Create output element for examples
        createOutputElement(example) {
            const output = document.createElement('div');
            output.className = 'output';
            example.appendChild(output);
            return output;
        },

        // Safe evaluation for simple demos
        safeEval(code) {
            // Very basic safe evaluation - extend as needed
            const safeGlobals = {
                console: {
                    log: (...args) => args.join(' ')
                },
                Math,
                Date,
                String,
                Number,
                Array,
                Object
            };

            const func = new Function(...Object.keys(safeGlobals), code);
            return func(...Object.values(safeGlobals));
        },

        // Enhanced navigation
        setupNavigation() {
            // Smooth scrolling for anchor links
            const anchorLinks = document.querySelectorAll('a[href^="#"]');
            anchorLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = link.getAttribute('href').slice(1);
                    const target = document.getElementById(targetId);
                    
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });

            // Auto-expand current chapter in sidebar
            const currentChapter = document.querySelector('.sidebar .chapter.active');
            if (currentChapter) {
                let parent = currentChapter.parentNode;
                while (parent && parent !== document.querySelector('.sidebar')) {
                    if (parent.classList.contains('chapter-section')) {
                        parent.classList.add('expanded');
                    }
                    parent = parent.parentNode;
                }
            }

            // Breadcrumb navigation
            this.updateBreadcrumbs();
        },

        // Update breadcrumb navigation
        updateBreadcrumbs() {
            const breadcrumbContainer = document.querySelector('.breadcrumbs') || this.createBreadcrumbs();
            const currentPage = document.querySelector('title').textContent;
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            
            breadcrumbContainer.innerHTML = '';
            
            // Add home link
            const homeLink = document.createElement('a');
            homeLink.href = './';
            homeLink.textContent = 'Home';
            breadcrumbContainer.appendChild(homeLink);

            // Add current page
            if (pathSegments.length > 0) {
                const separator = document.createElement('span');
                separator.textContent = ' / ';
                breadcrumbContainer.appendChild(separator);

                const currentLink = document.createElement('span');
                currentLink.textContent = currentPage.replace(' - Unjucks 2026', '');
                currentLink.className = 'current-page';
                breadcrumbContainer.appendChild(currentLink);
            }
        },

        // Create breadcrumbs container
        createBreadcrumbs() {
            const container = document.createElement('nav');
            container.className = 'breadcrumbs';
            container.setAttribute('aria-label', 'Breadcrumb');
            
            const content = document.querySelector('.content');
            if (content) {
                content.insertBefore(container, content.firstChild);
            }
            
            return container;
        },

        // Accessibility enhancements
        setupAccessibility() {
            // Skip to main content link
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            document.body.insertBefore(skipLink, document.body.firstChild);

            // Add main content ID
            const content = document.querySelector('.content');
            if (content) {
                content.id = 'main-content';
            }

            // Improve focus management
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    document.body.classList.add('using-keyboard');
                }
            });

            document.addEventListener('mousedown', () => {
                document.body.classList.remove('using-keyboard');
            });

            // Announce page changes to screen readers
            const title = document.querySelector('title').textContent;
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = `Page loaded: ${title}`;
            document.body.appendChild(announcement);
        },

        // Analytics and performance tracking
        setupAnalytics() {
            // Track reading progress
            let maxScroll = 0;
            let readingTime = 0;
            const startTime = Date.now();

            window.addEventListener('scroll', () => {
                const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
                maxScroll = Math.max(maxScroll, scrollPercent);
            });

            window.addEventListener('beforeunload', () => {
                readingTime = Date.now() - startTime;
                
                // Store reading metrics (you could send to analytics service)
                const metrics = {
                    page: window.location.pathname,
                    maxScroll: Math.round(maxScroll),
                    readingTime: Math.round(readingTime / 1000),
                    timestamp: Date.now()
                };
                
                localStorage.setItem('unjucks-reading-metrics', JSON.stringify(metrics));
            });

            // Track feature usage
            this.trackFeatureUsage();
        },

        // Track feature usage
        trackFeatureUsage() {
            const features = ['search', 'copy-code', 'theme-toggle', 'interactive-example'];
            
            features.forEach(feature => {
                document.addEventListener('click', (e) => {
                    if (e.target.closest(`.${feature}`) || e.target.classList.contains(feature)) {
                        const usage = JSON.parse(localStorage.getItem('unjucks-feature-usage') || '{}');
                        usage[feature] = (usage[feature] || 0) + 1;
                        localStorage.setItem('unjucks-feature-usage', JSON.stringify(usage));
                    }
                });
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UnjucksBook.init());
    } else {
        UnjucksBook.init();
    }

    // Add styles for new elements
    const style = document.createElement('style');
    style.textContent = `
        .theme-toggle {
            background: none;
            border: none;
            font-size: 1.2em;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        
        .theme-toggle:hover {
            background-color: var(--theme-bg-secondary, #f1f5f9);
        }
        
        .code-block-wrapper {
            position: relative;
        }
        
        .copy-button {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: var(--theme-bg-secondary, #f1f5f9);
            border: 1px solid var(--theme-border-primary, #e2e8f0);
            border-radius: 4px;
            padding: 0.25rem 0.5rem;
            cursor: pointer;
            font-size: 0.8em;
            transition: all 0.2s;
        }
        
        .copy-button:hover {
            background: var(--theme-bg-tertiary, #e2e8f0);
        }
        
        .search-highlight {
            background: var(--color-warning-200, #fef3c7);
            padding: 0.1em 0.2em;
            border-radius: 2px;
        }
        
        .breadcrumbs {
            font-size: 0.875rem;
            margin-bottom: 2rem;
            padding: 1rem 0;
            border-bottom: 1px solid var(--theme-border-primary, #e2e8f0);
        }
        
        .breadcrumbs a {
            color: var(--theme-primary, #2563eb);
            text-decoration: none;
        }
        
        .breadcrumbs a:hover {
            text-decoration: underline;
        }
        
        .breadcrumbs .current-page {
            color: var(--theme-text-secondary, #475569);
            font-weight: 500;
        }
        
        .output {
            margin-top: 1rem;
            padding: 1rem;
            background: var(--theme-bg-secondary, #f1f5f9);
            border-radius: 4px;
            border-left: 4px solid var(--color-success-500, #22c55e);
        }
        
        .output.error {
            border-left-color: var(--color-error-500, #ef4444);
            color: var(--color-error-700, #b91c1c);
        }
        
        body.using-keyboard *:focus {
            outline: 2px solid var(--theme-primary, #2563eb);
            outline-offset: 2px;
        }
        
        @media (max-width: 768px) {
            .copy-button {
                display: none;
            }
            
            .breadcrumbs {
                font-size: 0.75rem;
            }
        }
    `;
    
    document.head.appendChild(style);

})();