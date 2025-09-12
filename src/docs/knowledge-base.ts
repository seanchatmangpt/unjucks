/**
 * Searchable Knowledge Base
 * Enterprise documentation and knowledge management system with full-text search
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import * as yaml from 'yaml';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'internal' | 'restricted';
  language: string;
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    estimatedReadTime: number; // minutes
    lastReviewed?: string;
    reviewer?: string;
    sourceFile?: string;
    relatedArticles?: string[];
    attachments?: string[];
  };
  searchIndex: {
    keywords: string[];
    searchContent: string;
    boost: number;
  };
  analytics: {
    views: number;
    helpful: number;
    notHelpful: number;
    lastAccessed?: string;
  };
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  parent?: string;
  subcategories: string[];
  articleCount: number;
  featured: boolean;
  order: number;
}

export interface SearchQuery {
  query: string;
  categories?: string[];
  tags?: string[];
  difficulty?: string[];
  language?: string;
  status?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  article: KnowledgeArticle;
  score: number;
  relevance: number;
  highlights: string[];
  matchedTerms: string[];
}

export interface KnowledgeBaseStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  categories: number;
  totalViews: number;
  avgHelpfulness: number;
  articlesNeedingReview: number;
  topCategories: Array<{ category: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  recentActivity: Array<{
    type: 'created' | 'updated' | 'viewed' | 'archived';
    articleId: string;
    timestamp: string;
    user?: string;
  }>;
}

export interface KnowledgeBaseConfig {
  contentDir: string;
  outputDir: string;
  indexDir: string;
  mediaDir: string;
  enableSearch: boolean;
  enableAnalytics: boolean;
  enableVersioning: boolean;
  autoGenerateSummary: boolean;
  maxSearchResults: number;
  supportedLanguages: string[];
  reviewReminderDays: number;
}

export class KnowledgeBase {
  private config: KnowledgeBaseConfig;
  private articles: Map<string, KnowledgeArticle> = new Map();
  private categories: Map<string, KnowledgeCategory> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map(); // term -> article IDs
  private stats: KnowledgeBaseStats;

  constructor(config: KnowledgeBaseConfig) {
    this.config = config;
    this.ensureDirectories();
    this.loadCategories();
    this.loadArticles();
    this.buildSearchIndex();
    this.generateStats();
  }

  private ensureDirectories(): void {
    [
      this.config.contentDir,
      this.config.outputDir,
      this.config.indexDir,
      this.config.mediaDir,
      join(this.config.outputDir, 'html'),
      join(this.config.outputDir, 'json'),
      join(this.config.outputDir, 'exports'),
      join(this.config.indexDir, 'search'),
      join(this.config.indexDir, 'analytics')
    ].forEach(dir => {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    });
  }

  private loadCategories(): void {
    console.log('📂 Loading knowledge base categories...');

    try {
      const categoriesFile = join(this.config.contentDir, 'categories.yml');
      if (existsSync(categoriesFile)) {
        const content = readFileSync(categoriesFile, 'utf-8');
        const data = yaml.parse(content);
        
        if (data.categories) {
          data.categories.forEach((cat: any) => {
            this.categories.set(cat.id, {
              ...cat,
              articleCount: 0 // Will be updated when loading articles
            });
          });
        }
      } else {
        // Create default categories
        this.createDefaultCategories();
        this.saveCategories();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      this.createDefaultCategories();
    }

    console.log(`✅ Loaded ${this.categories.size} categories`);
  }

  private createDefaultCategories(): void {
    const defaultCategories: KnowledgeCategory[] = [
      {
        id: 'getting-started',
        name: 'Getting Started',
        description: 'Essential guides for new users',
        icon: '🚀',
        subcategories: ['installation', 'configuration', 'first-steps'],
        articleCount: 0,
        featured: true,
        order: 1
      },
      {
        id: 'tutorials',
        name: 'Tutorials',
        description: 'Step-by-step tutorials and guides',
        icon: '📖',
        subcategories: ['basic', 'advanced', 'examples'],
        articleCount: 0,
        featured: true,
        order: 2
      },
      {
        id: 'api-reference',
        name: 'API Reference',
        description: 'Complete API documentation',
        icon: '⚙️',
        subcategories: ['endpoints', 'authentication', 'examples'],
        articleCount: 0,
        featured: true,
        order: 3
      },
      {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Common issues and solutions',
        icon: '🔧',
        subcategories: ['errors', 'performance', 'debugging'],
        articleCount: 0,
        featured: true,
        order: 4
      },
      {
        id: 'best-practices',
        name: 'Best Practices',
        description: 'Recommended approaches and patterns',
        icon: '✨',
        subcategories: ['security', 'performance', 'architecture'],
        articleCount: 0,
        featured: false,
        order: 5
      },
      {
        id: 'compliance',
        name: 'Compliance',
        description: 'Compliance and regulatory guidance',
        icon: '🛡️',
        subcategories: ['sox', 'gdpr', 'pci-dss', 'hipaa'],
        articleCount: 0,
        featured: false,
        order: 6
      },
      {
        id: 'workflows',
        name: 'Workflows',
        description: 'GitHub Actions and CI/CD workflows',
        icon: '⚡',
        subcategories: ['actions', 'deployment', 'testing'],
        articleCount: 0,
        featured: false,
        order: 7
      }
    ];

    defaultCategories.forEach(cat => {
      this.categories.set(cat.id, cat);
    });
  }

  private saveCategories(): void {
    const categoriesData = {
      categories: Array.from(this.categories.values())
    };
    
    const categoriesFile = join(this.config.contentDir, 'categories.yml');
    writeFileSync(categoriesFile, yaml.stringify(categoriesData, { indent: 2 }), 'utf-8');
  }

  private loadArticles(): void {
    console.log('📄 Loading knowledge base articles...');

    const contentTypes = ['.md', '.mdx', '.txt'];
    let loadedCount = 0;

    const scanDirectory = (dir: string): void => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.')) {
            scanDirectory(fullPath);
          } else if (stat.isFile() && contentTypes.includes(extname(item).toLowerCase())) {
            const article = this.parseArticleFile(fullPath);
            if (article) {
              this.articles.set(article.id, article);
              loadedCount++;
              
              // Update category count
              const category = this.categories.get(article.category);
              if (category) {
                category.articleCount++;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    scanDirectory(this.config.contentDir);
    console.log(`✅ Loaded ${loadedCount} articles`);
  }

  private parseArticleFile(filePath: string): KnowledgeArticle | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      
      // Parse frontmatter if present
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      let frontmatter: any = {};
      let articleContent = content;
      
      if (frontmatterMatch) {
        try {
          frontmatter = yaml.parse(frontmatterMatch[1]);
          articleContent = frontmatterMatch[2];
        } catch (error) {
          console.error(`Error parsing frontmatter in ${filePath}:`, error);
        }
      }
      
      // Generate article ID
      const relativePath = filePath.replace(this.config.contentDir, '').replace(/^\//, '');
      const articleId = frontmatter.id || this.generateArticleId(relativePath);
      
      // Extract title
      const titleMatch = articleContent.match(/^#\s+(.+)$/m);
      const title = frontmatter.title || (titleMatch ? titleMatch[1] : basename(filePath, extname(filePath)));
      
      // Generate summary
      let summary = frontmatter.summary || '';
      if (!summary && this.config.autoGenerateSummary) {
        summary = this.generateSummary(articleContent);
      }
      
      // Estimate read time
      const estimatedReadTime = this.estimateReadTime(articleContent);
      
      // Extract keywords for search
      const keywords = this.extractKeywords(title + ' ' + articleContent);
      
      const article: KnowledgeArticle = {
        id: articleId,
        title,
        content: articleContent,
        summary,
        category: frontmatter.category || 'general',
        subcategory: frontmatter.subcategory,
        tags: frontmatter.tags || [],
        author: frontmatter.author || 'System',
        createdAt: frontmatter.createdAt || stat.birthtime.toISOString(),
        updatedAt: frontmatter.updatedAt || stat.mtime.toISOString(),
        version: frontmatter.version || '1.0.0',
        status: frontmatter.status || 'published',
        visibility: frontmatter.visibility || 'public',
        language: frontmatter.language || 'en',
        metadata: {
          difficulty: frontmatter.difficulty || 'intermediate',
          estimatedReadTime,
          lastReviewed: frontmatter.lastReviewed,
          reviewer: frontmatter.reviewer,
          sourceFile: relativePath,
          relatedArticles: frontmatter.relatedArticles || [],
          attachments: frontmatter.attachments || []
        },
        searchIndex: {
          keywords,
          searchContent: this.createSearchContent(title, articleContent, frontmatter.tags || []),
          boost: frontmatter.boost || 1.0
        },
        analytics: {
          views: 0,
          helpful: 0,
          notHelpful: 0
        }
      };
      
      return article;
      
    } catch (error) {
      console.error(`Error parsing article ${filePath}:`, error);
      return null;
    }
  }

  private generateArticleId(filePath: string): string {
    return filePath
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace special chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .toLowerCase();
  }

  private generateSummary(content: string, maxLength: number = 200): string {
    // Remove markdown formatting
    const cleanContent = content
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Images
      .trim();

    // Get first paragraph or first few sentences
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let summary = '';
    
    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
    }
    
    return summary.trim();
  }

  private estimateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  private extractKeywords(text: string): string[] {
    // Remove markdown and special characters
    const cleanText = text
      .replace(/[#*`\[\]()_~]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    // Split into words and filter
    const words = cleanText.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Get unique words and sort by frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'as', 'you', 'do',
      'at', 'this', 'but', 'his', 'by', 'from', 'they', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
      'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who',
      'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
      'time', 'no', 'just', 'him', 'know', 'take', 'people',
      'into', 'year', 'your', 'good', 'some', 'could', 'them',
      'see', 'other', 'than', 'then', 'now', 'look', 'only',
      'come', 'its', 'over', 'think', 'also', 'back', 'after',
      'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
      'even', 'new', 'want', 'because', 'any', 'these', 'give',
      'day', 'most', 'us'
    ]);
    
    return stopWords.has(word);
  }

  private createSearchContent(title: string, content: string, tags: string[]): string {
    return [
      title,
      content.replace(/[#*`\[\]()_~]/g, ' ').replace(/\s+/g, ' '),
      tags.join(' ')
    ].join(' ').toLowerCase();
  }

  private buildSearchIndex(): void {
    if (!this.config.enableSearch) return;
    
    console.log('🔍 Building search index...');
    
    this.searchIndex.clear();
    
    for (const article of this.articles.values()) {
      // Index title words
      const titleWords = article.title.toLowerCase().split(/\s+/);
      titleWords.forEach(word => {
        if (!this.isStopWord(word)) {
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word)!.add(article.id);
        }
      });
      
      // Index keywords
      article.searchIndex.keywords.forEach(keyword => {
        if (!this.searchIndex.has(keyword)) {
          this.searchIndex.set(keyword, new Set());
        }
        this.searchIndex.get(keyword)!.add(article.id);
      });
      
      // Index tags
      article.tags.forEach(tag => {
        const tagKey = `tag:${tag.toLowerCase()}`;
        if (!this.searchIndex.has(tagKey)) {
          this.searchIndex.set(tagKey, new Set());
        }
        this.searchIndex.get(tagKey)!.add(article.id);
      });
      
      // Index category
      const categoryKey = `category:${article.category.toLowerCase()}`;
      if (!this.searchIndex.has(categoryKey)) {
        this.searchIndex.set(categoryKey, new Set());
      }
      this.searchIndex.get(categoryKey)!.add(article.id);
    }
    
    console.log(`✅ Built search index with ${this.searchIndex.size} terms`);
  }

  public search(query: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryTerms = query.query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    if (queryTerms.length === 0) {
      return results;
    }
    
    // Find matching articles
    const articleScores = new Map<string, { score: number; matchedTerms: Set<string> }>();
    
    for (const term of queryTerms) {
      // Exact term matches
      if (this.searchIndex.has(term)) {
        for (const articleId of this.searchIndex.get(term)!) {
          const current = articleScores.get(articleId) || { score: 0, matchedTerms: new Set() };
          current.score += 10; // High score for exact matches
          current.matchedTerms.add(term);
          articleScores.set(articleId, current);
        }
      }
      
      // Partial matches
      for (const [indexTerm, articleIds] of this.searchIndex) {
        if (indexTerm.includes(term) && indexTerm !== term) {
          for (const articleId of articleIds) {
            const current = articleScores.get(articleId) || { score: 0, matchedTerms: new Set() };
            current.score += 5; // Lower score for partial matches
            current.matchedTerms.add(term);
            articleScores.set(articleId, current);
          }
        }
      }
      
      // Content search
      for (const article of this.articles.values()) {
        if (article.searchIndex.searchContent.includes(term)) {
          const current = articleScores.get(article.id) || { score: 0, matchedTerms: new Set() };
          current.score += 3; // Content match score
          current.matchedTerms.add(term);
          articleScores.set(article.id, current);
        }
      }
    }
    
    // Filter by criteria
    for (const [articleId, scoreData] of articleScores) {
      const article = this.articles.get(articleId);
      if (!article) continue;
      
      // Apply filters
      if (query.categories && !query.categories.includes(article.category)) continue;
      if (query.tags && !query.tags.some(tag => article.tags.includes(tag))) continue;
      if (query.difficulty && !query.difficulty.includes(article.metadata.difficulty)) continue;
      if (query.language && article.language !== query.language) continue;
      if (query.status && !query.status.includes(article.status)) continue;
      
      // Calculate final score
      let finalScore = scoreData.score * article.searchIndex.boost;
      
      // Boost for title matches
      if (queryTerms.some(term => article.title.toLowerCase().includes(term))) {
        finalScore *= 2;
      }
      
      // Generate highlights
      const highlights = this.generateHighlights(article, queryTerms);
      
      results.push({
        article,
        score: finalScore,
        relevance: Math.min(100, Math.round((finalScore / queryTerms.length) * 10)),
        highlights,
        matchedTerms: Array.from(scoreData.matchedTerms)
      });
    }
    
    // Sort by score and apply limits
    results.sort((a, b) => b.score - a.score);
    
    const limit = Math.min(query.limit || this.config.maxSearchResults, this.config.maxSearchResults);
    const offset = query.offset || 0;
    
    return results.slice(offset, offset + limit);
  }

  private generateHighlights(article: KnowledgeArticle, queryTerms: string[]): string[] {
    const highlights: string[] = [];
    const content = article.content.toLowerCase();
    
    for (const term of queryTerms) {
      const termIndex = content.indexOf(term);
      if (termIndex !== -1) {
        const start = Math.max(0, termIndex - 50);
        const end = Math.min(content.length, termIndex + term.length + 50);
        let highlight = article.content.substring(start, end);
        
        // Add ellipsis if truncated
        if (start > 0) highlight = '...' + highlight;
        if (end < content.length) highlight = highlight + '...';
        
        // Highlight the term (basic implementation)
        const regex = new RegExp(`(${term})`, 'gi');
        highlight = highlight.replace(regex, '**$1**');
        
        highlights.push(highlight);
      }
    }
    
    return highlights.slice(0, 3); // Max 3 highlights per article
  }

  public getArticle(id: string): KnowledgeArticle | null {
    const article = this.articles.get(id);
    
    if (article && this.config.enableAnalytics) {
      // Update analytics
      article.analytics.views++;
      article.analytics.lastAccessed = this.getDeterministicDate().toISOString();
    }
    
    return article ? { ...article } : null;
  }

  public getArticlesByCategory(categoryId: string): KnowledgeArticle[] {
    return Array.from(this.articles.values())
      .filter(article => article.category === categoryId)
      .filter(article => article.status === 'published')
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  public getFeaturedArticles(limit: number = 10): KnowledgeArticle[] {
    return Array.from(this.articles.values())
      .filter(article => article.status === 'published')
      .sort((a, b) => b.analytics.views - a.analytics.views)
      .slice(0, limit);
  }

  public getRecentArticles(limit: number = 10): KnowledgeArticle[] {
    return Array.from(this.articles.values())
      .filter(article => article.status === 'published')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  public getCategories(): KnowledgeCategory[] {
    return Array.from(this.categories.values())
      .sort((a, b) => a.order - b.order);
  }

  public addFeedback(articleId: string, helpful: boolean): boolean {
    const article = this.articles.get(articleId);
    if (!article) return false;
    
    if (helpful) {
      article.analytics.helpful++;
    } else {
      article.analytics.notHelpful++;
    }
    
    return true;
  }

  private generateStats(): void {
    console.log('📊 Generating knowledge base statistics...');
    
    const articles = Array.from(this.articles.values());
    
    // Category counts
    const categoryCounts = new Map<string, number>();
    articles.forEach(article => {
      categoryCounts.set(article.category, (categoryCounts.get(article.category) || 0) + 1);
    });
    
    // Tag counts
    const tagCounts = new Map<string, number>();
    articles.forEach(article => {
      article.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    // Calculate review needs
    const reviewReminderMs = this.config.reviewReminderDays * 24 * 60 * 60 * 1000;
    const now = this.getDeterministicTimestamp();
    const needsReview = articles.filter(article => {
      const lastReview = article.metadata.lastReviewed ? new Date(article.metadata.lastReviewed).getTime() : 0;
      return (now - lastReview) > reviewReminderMs;
    });
    
    this.stats = {
      totalArticles: articles.length,
      publishedArticles: articles.filter(a => a.status === 'published').length,
      draftArticles: articles.filter(a => a.status === 'draft').length,
      categories: this.categories.size,
      totalViews: articles.reduce((sum, a) => sum + a.analytics.views, 0),
      avgHelpfulness: this.calculateAverageHelpfulness(articles),
      articlesNeedingReview: needsReview.length,
      topCategories: Array.from(categoryCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => ({ category, count })),
      topTags: Array.from(tagCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
      recentActivity: [] // Would be populated from activity log
    };
  }

  private calculateAverageHelpfulness(articles: KnowledgeArticle[]): number {
    let totalFeedback = 0;
    let helpfulFeedback = 0;
    
    articles.forEach(article => {
      const feedback = article.analytics.helpful + article.analytics.notHelpful;
      if (feedback > 0) {
        totalFeedback += feedback;
        helpfulFeedback += article.analytics.helpful;
      }
    });
    
    return totalFeedback > 0 ? Math.round((helpfulFeedback / totalFeedback) * 100) : 0;
  }

  public getStats(): KnowledgeBaseStats {
    this.generateStats();
    return { ...this.stats };
  }

  public generateSitemap(): string {
    console.log('🗺️  Generating knowledge base sitemap...');
    
    let sitemap = `# Knowledge Base Sitemap\n\n`;
    sitemap += `Generated: ${this.getDeterministicDate().toISOString()}\n\n`;
    
    // Categories
    for (const category of this.getCategories()) {
      sitemap += `## ${category.name}\n\n`;
      sitemap += `${category.description}\n\n`;
      
      const categoryArticles = this.getArticlesByCategory(category.id);
      
      if (categoryArticles.length > 0) {
        categoryArticles.forEach(article => {
          sitemap += `- [${article.title}](${this.getArticleUrl(article.id)})\n`;
        });
        sitemap += '\n';
      } else {
        sitemap += '*No articles in this category yet.*\n\n';
      }
    }
    
    const sitemapPath = join(this.config.outputDir, 'sitemap.md');
    writeFileSync(sitemapPath, sitemap, 'utf-8');
    console.log(`📝 Generated sitemap: ${sitemapPath}`);
    
    return sitemapPath;
  }

  private getArticleUrl(articleId: string): string {
    return `/kb/articles/${articleId}`;
  }

  public exportToHTML(): string {
    console.log('🌐 Exporting knowledge base to HTML...');
    
    const htmlDir = join(this.config.outputDir, 'html');
    
    // Generate index page
    this.generateHTMLIndex(htmlDir);
    
    // Generate category pages
    for (const category of this.categories.values()) {
      this.generateCategoryHTML(category, htmlDir);
    }
    
    // Generate article pages
    for (const article of this.articles.values()) {
      if (article.status === 'published') {
        this.generateArticleHTML(article, htmlDir);
      }
    }
    
    // Generate search page
    this.generateSearchHTML(htmlDir);
    
    console.log(`✅ Exported HTML to ${htmlDir}`);
    return htmlDir;
  }

  private generateHTMLIndex(htmlDir: string): void {
    const indexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge Base</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .category-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: white; }
        .category-header { display: flex; align-items: center; margin-bottom: 10px; }
        .category-icon { font-size: 1.5em; margin-right: 10px; }
        .category-name { font-size: 1.2em; font-weight: bold; }
        .category-description { color: #666; margin-bottom: 10px; }
        .article-count { color: #007bff; font-weight: bold; }
        .search-box { width: 100%; padding: 15px; font-size: 16px; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Knowledge Base</h1>
            <p>Your comprehensive documentation and help center</p>
        </div>
        
        <input type="text" class="search-box" placeholder="Search articles..." onkeyup="if(event.key==='Enter') window.location.href='search.html?q='+encodeURIComponent(this.value)">
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${this.stats.totalArticles}</div>
                <div>Total Articles</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.stats.categories}</div>
                <div>Categories</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.stats.totalViews.toLocaleString()}</div>
                <div>Total Views</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.stats.avgHelpfulness}%</div>
                <div>Helpfulness</div>
            </div>
        </div>
        
        <div class="categories">
            ${Array.from(this.categories.values())
              .filter(cat => cat.featured)
              .map(category => `
                <div class="category-card">
                    <div class="category-header">
                        <span class="category-icon">${category.icon || '📁'}</span>
                        <span class="category-name">${category.name}</span>
                    </div>
                    <div class="category-description">${category.description}</div>
                    <div class="article-count">${category.articleCount} articles</div>
                </div>
              `).join('')}
        </div>
    </div>
</body>
</html>`;

    writeFileSync(join(htmlDir, 'index.html'), indexHTML, 'utf-8');
  }

  private generateCategoryHTML(category: KnowledgeCategory, htmlDir: string): void {
    // Implementation for category pages
    console.log(`Generating HTML for category: ${category.name}`);
  }

  private generateArticleHTML(article: KnowledgeArticle, htmlDir: string): void {
    // Implementation for article pages  
    console.log(`Generating HTML for article: ${article.title}`);
  }

  private generateSearchHTML(htmlDir: string): void {
    // Implementation for search page
    console.log('Generating search page');
  }

  public exportToJSON(): string {
    console.log('📄 Exporting knowledge base to JSON...');
    
    const jsonDir = join(this.config.outputDir, 'json');
    
    // Export articles
    const articlesData = {
      articles: Array.from(this.articles.values()),
      categories: Array.from(this.categories.values()),
      stats: this.stats,
      exportedAt: this.getDeterministicDate().toISOString()
    };
    
    const articlesPath = join(jsonDir, 'knowledge-base.json');
    writeFileSync(articlesPath, JSON.stringify(articlesData, null, 2), 'utf-8');
    
    // Export search index
    const searchIndexData = {
      index: Object.fromEntries(
        Array.from(this.searchIndex.entries()).map(([term, ids]) => [term, Array.from(ids)])
      ),
      generatedAt: this.getDeterministicDate().toISOString()
    };
    
    const indexPath = join(jsonDir, 'search-index.json');
    writeFileSync(indexPath, JSON.stringify(searchIndexData, null, 2), 'utf-8');
    
    console.log(`✅ Exported JSON to ${jsonDir}`);
    return jsonDir;
  }

  public async generateTrainingMaterials(): Promise<void> {
    console.log('🎓 Generating training materials...');
    
    const trainingDir = join(this.config.outputDir, 'training');
    mkdirSync(trainingDir, { recursive: true });
    
    // Generate learning paths
    await this.generateLearningPaths(trainingDir);
    
    // Generate quizzes
    await this.generateQuizzes(trainingDir);
    
    // Generate certificates
    await this.generateCertificateTemplates(trainingDir);
    
    console.log(`✅ Generated training materials in ${trainingDir}`);
  }

  private async generateLearningPaths(trainingDir: string): Promise<void> {
    const learningPaths = [
      {
        id: 'getting-started-path',
        name: 'Getting Started Learning Path',
        description: 'Complete beginner guide to using the system',
        difficulty: 'beginner',
        estimatedTime: '2 hours',
        articles: this.getArticlesByCategory('getting-started').slice(0, 5)
      },
      {
        id: 'advanced-path', 
        name: 'Advanced User Path',
        description: 'Advanced features and best practices',
        difficulty: 'advanced',
        estimatedTime: '4 hours',
        articles: this.getArticlesByCategory('best-practices')
      }
    ];
    
    const pathsData = { learningPaths, generatedAt: this.getDeterministicDate().toISOString() };
    writeFileSync(join(trainingDir, 'learning-paths.json'), JSON.stringify(pathsData, null, 2), 'utf-8');
  }

  private async generateQuizzes(trainingDir: string): Promise<void> {
    // Generate quiz questions based on article content
    const quizzes = [];
    
    for (const category of this.categories.values()) {
      const categoryArticles = this.getArticlesByCategory(category.id);
      if (categoryArticles.length > 0) {
        quizzes.push({
          id: `quiz-${category.id}`,
          name: `${category.name} Quiz`,
          category: category.id,
          questions: this.generateQuizQuestions(categoryArticles)
        });
      }
    }
    
    writeFileSync(join(trainingDir, 'quizzes.json'), JSON.stringify({ quizzes }, null, 2), 'utf-8');
  }

  private generateQuizQuestions(articles: KnowledgeArticle[]): any[] {
    // Basic implementation - would use NLP to generate better questions
    return articles.slice(0, 3).map((article, index) => ({
      id: `q${index + 1}`,
      question: `What is the main topic of "${article.title}"?`,
      type: 'multiple-choice',
      options: [
        article.summary || 'Main topic',
        'Unrelated topic A',
        'Unrelated topic B',
        'Unrelated topic C'
      ],
      correctAnswer: 0,
      explanation: article.summary
    }));
  }

  private async generateCertificateTemplates(trainingDir: string): Promise<void> {
    const certificateTemplate = `# Certificate of Completion

**This certifies that**

**{{USER_NAME}}**

**has successfully completed the**

**{{LEARNING_PATH_NAME}}**

**on {{COMPLETION_DATE}}**

**Total Time:** {{TOTAL_TIME}}
**Articles Completed:** {{ARTICLES_COUNT}}
**Quiz Score:** {{QUIZ_SCORE}}%

---

*Knowledge Base Certification System*
*Generated on {{GENERATED_DATE}}*`;

    writeFileSync(join(trainingDir, 'certificate-template.md'), certificateTemplate, 'utf-8');
  }
}

// CLI interface
if (require.main === module) {
  const config: KnowledgeBaseConfig = {
    contentDir: process.env.CONTENT_DIR || 'docs/knowledge-base',
    outputDir: process.env.OUTPUT_DIR || 'docs/kb-output',
    indexDir: process.env.INDEX_DIR || 'docs/kb-indexes',
    mediaDir: process.env.MEDIA_DIR || 'docs/kb-media',
    enableSearch: process.env.ENABLE_SEARCH !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableVersioning: process.env.ENABLE_VERSIONING === 'true',
    autoGenerateSummary: process.env.AUTO_GENERATE_SUMMARY !== 'false',
    maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS || '50'),
    supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,es,fr,de').split(','),
    reviewReminderDays: parseInt(process.env.REVIEW_REMINDER_DAYS || '180')
  };

  const kb = new KnowledgeBase(config);

  // Generate outputs
  kb.generateSitemap();
  kb.exportToHTML();
  kb.exportToJSON();
  kb.generateTrainingMaterials();

  // Example search
  console.log('\n🔍 Example Search Results:');
  const searchResults = kb.search({
    query: 'getting started setup',
    limit: 3
  });

  searchResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.article.title} (Score: ${result.score}, Relevance: ${result.relevance}%)`);
    console.log(`   Category: ${result.article.category}`);
    console.log(`   Tags: ${result.article.tags.join(', ')}`);
    if (result.highlights.length > 0) {
      console.log(`   Highlight: ${result.highlights[0].substring(0, 100)}...`);
    }
  });

  console.log('\n📊 Knowledge Base Statistics:');
  const stats = kb.getStats();
  console.log(`   Total Articles: ${stats.totalArticles}`);
  console.log(`   Published: ${stats.publishedArticles}`);
  console.log(`   Categories: ${stats.categories}`);
  console.log(`   Average Helpfulness: ${stats.avgHelpfulness}%`);
  console.log(`   Articles Needing Review: ${stats.articlesNeedingReview}`);
}