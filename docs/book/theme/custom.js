// Unjucks Custom Theme JavaScript

(function() {
    'use strict';

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Unjucks documentation loaded');
        
        // Add version info to footer
        addVersionInfo();
        
        // Enhance code blocks
        enhanceCodeBlocks();
        
        // Add copy buttons to code blocks
        addCopyButtons();
        
        // Add scroll progress indicator
        addScrollProgress();
        
        // Add search enhancements
        enhanceSearch();
        
        // Add custom navigation
        addCustomNavigation();
        
        // Analytics tracking (if enabled)
        initializeAnalytics();
    });

    function addVersionInfo() {
        const footer = document.querySelector('.nav-chapters') || document.body;
        const versionInfo = document.createElement('div');
        versionInfo.className = 'unjucks-version-info';
        versionInfo.innerHTML = `
            <div style="text-align: center; padding: 1rem; font-size: 0.8rem; color: #666;">
                <p>📚 Unjucks Documentation v1.0.0</p>
                <p>🌐 <a href="https://unjucks.dev" target="_blank">unjucks.dev</a> | 
                   💻 <a href="https://github.com/ruvnet/unjucks" target="_blank">GitHub</a></p>
            </div>
        `;
        footer.appendChild(versionInfo);
    }

    function enhanceCodeBlocks() {
        const codeBlocks = document.querySelectorAll('pre code');
        codeBlocks.forEach(function(block, index) {
            // Add language label if detected
            const className = block.className;
            const langMatch = className.match(/language-(\w+)/);
            if (langMatch) {
                const language = langMatch[1];
                const label = document.createElement('div');
                label.className = 'code-language-label';
                label.textContent = language.toUpperCase();
                label.style.cssText = `
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    background: #0066cc;
                    color: white;
                    padding: 0.2rem 0.5rem;
                    border-radius: 3px;
                    font-size: 0.75rem;
                    font-weight: bold;
                `;
                
                const pre = block.parentElement;
                pre.style.position = 'relative';
                pre.appendChild(label);
            }

            // Add line numbers for longer code blocks
            if (block.textContent.split('\n').length > 5) {
                addLineNumbers(block);
            }
        });
    }

    function addLineNumbers(codeBlock) {
        const lines = codeBlock.textContent.split('\n');
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'line-numbers';
        lineNumbers.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            padding: 1rem 0.5rem;
            background: #f0f0f0;
            border-right: 1px solid #ddd;
            font-family: monospace;
            font-size: 0.8rem;
            line-height: 1.5;
            color: #666;
            user-select: none;
            min-width: 2.5rem;
            text-align: right;
        `;

        for (let i = 1; i <= lines.length - 1; i++) {
            lineNumbers.innerHTML += i + '\n';
        }

        const pre = codeBlock.parentElement;
        pre.style.position = 'relative';
        pre.style.paddingLeft = '3.5rem';
        pre.appendChild(lineNumbers);
    }

    function addCopyButtons() {
        const codeBlocks = document.querySelectorAll('pre');
        codeBlocks.forEach(function(pre) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.innerHTML = '📋 Copy';
            button.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: #28a745;
                color: white;
                border: none;
                padding: 0.3rem 0.6rem;
                border-radius: 3px;
                cursor: pointer;
                font-size: 0.75rem;
                transition: all 0.3s ease;
                z-index: 10;
            `;

            button.addEventListener('click', function() {
                const code = pre.querySelector('code');
                const text = code.textContent;
                
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(function() {
                        button.innerHTML = '✅ Copied!';
                        button.style.background = '#007bff';
                        setTimeout(function() {
                            button.innerHTML = '📋 Copy';
                            button.style.background = '#28a745';
                        }, 2000);
                    });
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    button.innerHTML = '✅ Copied!';
                    setTimeout(function() {
                        button.innerHTML = '📋 Copy';
                    }, 2000);
                }
            });

            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }

    function addScrollProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: linear-gradient(90deg, #0066cc, #4a90e2, #ff6b35);
            z-index: 1000;
            transition: width 0.3s ease;
        `;
        document.body.appendChild(progressBar);

        window.addEventListener('scroll', function() {
            const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
            progressBar.style.width = Math.min(scrolled, 100) + '%';
        });
    }

    function enhanceSearch() {
        const searchbar = document.getElementById('searchbar');
        if (searchbar) {
            // Add search suggestions
            const suggestions = document.createElement('div');
            suggestions.className = 'search-suggestions';
            suggestions.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                max-height: 300px;
                overflow-y: auto;
                z-index: 100;
                display: none;
            `;
            
            searchbar.parentElement.style.position = 'relative';
            searchbar.parentElement.appendChild(suggestions);

            // Common search terms for Unjucks
            const commonSearches = [
                'getting started', 'templates', 'generators', 'configuration',
                'cli commands', 'examples', 'troubleshooting', 'deployment',
                'semantic web', 'rdf', 'mcp integration'
            ];

            searchbar.addEventListener('focus', function() {
                if (!searchbar.value) {
                    suggestions.innerHTML = commonSearches
                        .map(term => `<div class="search-suggestion" style="padding: 0.5rem; cursor: pointer; border-bottom: 1px solid #eee;">${term}</div>`)
                        .join('');
                    suggestions.style.display = 'block';
                }
            });

            document.addEventListener('click', function(e) {
                if (!searchbar.parentElement.contains(e.target)) {
                    suggestions.style.display = 'none';
                }
            });
        }
    }

    function addCustomNavigation() {
        // Add "Edit this page" link
        const content = document.querySelector('.content');
        if (content) {
            const editLink = document.createElement('div');
            editLink.className = 'edit-page-link';
            editLink.style.cssText = `
                text-align: right;
                padding: 1rem 0;
                border-top: 1px solid #eee;
                margin-top: 2rem;
            `;
            
            const currentPath = window.location.pathname;
            const githubPath = currentPath.replace('.html', '.md').replace(/^\/?/, '');
            
            editLink.innerHTML = `
                <a href="https://github.com/ruvnet/unjucks/edit/main/docs/book/src/${githubPath}" 
                   target="_blank" 
                   style="color: #0066cc; text-decoration: none; font-size: 0.9rem;">
                    ✏️ Edit this page on GitHub
                </a>
            `;
            
            content.appendChild(editLink);
        }

        // Add back to top button
        const backToTop = document.createElement('button');
        backToTop.className = 'back-to-top';
        backToTop.innerHTML = '⬆️ Top';
        backToTop.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #0066cc;
            color: white;
            border: none;
            padding: 0.75rem 1rem;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(100px);
            z-index: 100;
        `;

        backToTop.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', function() {
            if (window.scrollY > 500) {
                backToTop.style.opacity = '1';
                backToTop.style.transform = 'translateY(0)';
            } else {
                backToTop.style.opacity = '0';
                backToTop.style.transform = 'translateY(100px)';
            }
        });

        document.body.appendChild(backToTop);
    }

    function initializeAnalytics() {
        // Only initialize if analytics ID is configured
        const analyticsId = 'G-UNJUCKS-ANALYTICS'; // Replace with actual ID
        
        if (analyticsId && analyticsId !== 'G-UNJUCKS-ANALYTICS') {
            // Initialize Google Analytics 4
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
            document.head.appendChild(script);

            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', analyticsId);

            // Track page views
            gtag('event', 'page_view', {
                page_title: document.title,
                page_location: window.location.href
            });
        }

        // Track custom events
        trackCustomEvents();
    }

    function trackCustomEvents() {
        // Track search usage
        const searchbar = document.getElementById('searchbar');
        if (searchbar) {
            searchbar.addEventListener('input', debounce(function() {
                if (window.gtag && searchbar.value.length > 2) {
                    gtag('event', 'search', {
                        search_term: searchbar.value
                    });
                }
            }, 1000));
        }

        // Track code copy events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('copy-button') && window.gtag) {
                gtag('event', 'code_copy', {
                    event_category: 'engagement'
                });
            }
        });

        // Track external links
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' && e.target.hostname !== window.location.hostname) {
                if (window.gtag) {
                    gtag('event', 'click', {
                        event_category: 'outbound',
                        event_label: e.target.href
                    });
                }
            }
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = function() {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Add custom CSS for enhanced features
    const style = document.createElement('style');
    style.textContent = `
        .search-suggestion:hover {
            background-color: #f0f0f0;
        }
        
        .copy-button:hover {
            background-color: #218838 !important;
        }
        
        .back-to-top:hover {
            background-color: #0056b3;
            transform: scale(1.05);
        }
        
        .edit-page-link a:hover {
            text-decoration: underline;
        }
    `;
    document.head.appendChild(style);

})();