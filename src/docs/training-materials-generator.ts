/**
 * Training Materials Generator
 * Automated generation of training materials, video tutorials, and interactive content
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'yaml';

const execAsync = promisify(exec);

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'documentation' | 'compliance' | 'workflows' | 'api' | 'security' | 'best-practices';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedDuration: number; // minutes
  prerequisites: string[];
  learningObjectives: string[];
  content: {
    slides: TrainingSlide[];
    exercises: TrainingExercise[];
    assessments: TrainingAssessment[];
    resources: TrainingResource[];
  };
  videoScript?: VideoScript;
  interactiveElements: InteractiveElement[];
  metadata: {
    author: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    audience: string[];
  };
}

export interface TrainingSlide {
  id: string;
  title: string;
  content: string;
  type: 'intro' | 'concept' | 'example' | 'demo' | 'exercise' | 'summary';
  duration: number; // seconds
  speakerNotes?: string;
  animations?: SlideAnimation[];
  media?: {
    images?: string[];
    videos?: string[];
    audio?: string[];
    diagrams?: string[];
  };
  codeExamples?: CodeExample[];
}

export interface SlideAnimation {
  element: string;
  type: 'fade-in' | 'slide-in' | 'zoom' | 'highlight' | 'bounce';
  delay: number;
  duration: number;
}

export interface CodeExample {
  language: string;
  code: string;
  description: string;
  executable: boolean;
  expected_output?: string;
}

export interface TrainingExercise {
  id: string;
  title: string;
  description: string;
  type: 'hands-on' | 'scenario' | 'problem-solving' | 'code-review' | 'configuration';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // minutes
  instructions: string[];
  resources: string[];
  solution?: {
    description: string;
    steps: string[];
    code?: string;
    files?: Record<string, string>;
  };
  validation?: {
    type: 'automatic' | 'manual' | 'peer-review';
    criteria: string[];
    tests?: string[];
  };
}

export interface TrainingAssessment {
  id: string;
  title: string;
  type: 'quiz' | 'practical' | 'project' | 'certification';
  passingScore: number; // percentage
  timeLimit: number; // minutes
  questions: AssessmentQuestion[];
  feedback: {
    correct: string;
    incorrect: string;
    partial: string;
  };
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'code' | 'scenario';
  question: string;
  points: number;
  options?: string[];
  correctAnswer: string | number | string[];
  explanation?: string;
  hints?: string[];
  codeTemplate?: string;
}

export interface TrainingResource {
  id: string;
  title: string;
  type: 'document' | 'video' | 'link' | 'tool' | 'template' | 'checklist';
  url?: string;
  description: string;
  downloadable: boolean;
  size?: number; // bytes
  format?: string;
}

export interface VideoScript {
  title: string;
  duration: number; // seconds
  scenes: VideoScene[];
  voiceoverText: string;
  subtitles: Subtitle[];
  callToActions: CallToAction[];
}

export interface VideoScene {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  description: string;
  screenCapture?: boolean;
  slides?: string[];
  animations?: string[];
  voiceover: string;
}

export interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
  position?: 'bottom' | 'top' | 'center';
}

export interface CallToAction {
  time: number;
  type: 'link' | 'button' | 'overlay' | 'annotation';
  text: string;
  url?: string;
  action?: string;
}

export interface InteractiveElement {
  id: string;
  type: 'simulation' | 'demo' | 'sandbox' | 'calculator' | 'workflow-builder' | 'decision-tree';
  title: string;
  description: string;
  config: Record<string, any>;
  integration?: {
    platform: string;
    apiKey?: string;
    endpoint?: string;
  };
}

export interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  modules: string[]; // Module IDs
  totalDuration: number;
  certification?: {
    name: string;
    validityPeriod: number; // months
    requirements: string[];
  };
  schedule?: {
    type: 'self-paced' | 'instructor-led' | 'blended';
    sessions?: TrainingSession[];
  };
}

export interface TrainingSession {
  id: string;
  title: string;
  date: string;
  duration: number;
  moduleIds: string[];
  instructor?: string;
  maxParticipants?: number;
}

export interface TrainingGeneratorConfig {
  contentDir: string;
  outputDir: string;
  templatesDir: string;
  mediaDir: string;
  videoOutputDir: string;
  enableVideoGeneration: boolean;
  enableInteractiveContent: boolean;
  videoSettings: {
    resolution: '720p' | '1080p' | '4K';
    frameRate: number;
    bitRate: string;
    format: 'mp4' | 'webm' | 'avi';
  };
  slideSettings: {
    theme: string;
    aspectRatio: '16:9' | '4:3' | '21:9';
    transitionSpeed: number;
    fontFamily: string;
  };
  generateFormats: ('html' | 'pdf' | 'pptx' | 'video' | 'scorm')[];
  languages: string[];
  branding: {
    logo?: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
    };
    fonts: {
      heading: string;
      body: string;
      code: string;
    };
  };
}

export class TrainingMaterialsGenerator {
  private config: TrainingGeneratorConfig;
  private modules: Map<string, TrainingModule> = new Map();
  private programs: Map<string, TrainingProgram> = new Map();
  private templates: Map<string, string> = new Map();

  constructor(config: TrainingGeneratorConfig) {
    this.config = config;
    this.ensureDirectories();
    this.loadTemplates();
    this.loadModules();
    this.loadPrograms();
  }

  private ensureDirectories(): void {
    [
      this.config.contentDir,
      this.config.outputDir,
      this.config.templatesDir,
      this.config.mediaDir,
      this.config.videoOutputDir,
      join(this.config.outputDir, 'html'),
      join(this.config.outputDir, 'pdf'),
      join(this.config.outputDir, 'video'),
      join(this.config.outputDir, 'scorm'),
      join(this.config.outputDir, 'interactive'),
      join(this.config.mediaDir, 'images'),
      join(this.config.mediaDir, 'videos'),
      join(this.config.mediaDir, 'audio'),
      join(this.config.mediaDir, 'diagrams')
    ].forEach(dir => {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    });
  }

  private loadTemplates(): void {
    console.log('📄 Loading training templates...');

    try {
      const templateFiles = readdirSync(this.config.templatesDir)
        .filter(file => file.endsWith('.html') || file.endsWith('.md'));

      for (const file of templateFiles) {
        const templatePath = join(this.config.templatesDir, file);
        const templateName = basename(file, extname(file));
        const templateContent = readFileSync(templatePath, 'utf-8');
        this.templates.set(templateName, templateContent);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      this.createDefaultTemplates();
    }

    console.log(`✅ Loaded ${this.templates.size} templates`);
  }

  private createDefaultTemplates(): void {
    // Slide template
    const slideTemplate = `<!DOCTYPE html>
<html lang="{{language}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        body { font-family: '{{fontFamily}}', sans-serif; margin: 0; padding: 40px; background: {{backgroundColor}}; }
        .slide { max-width: 1200px; margin: 0 auto; background: white; padding: 60px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        h1 { color: {{primaryColor}}; font-size: 3em; margin-bottom: 30px; }
        h2 { color: {{secondaryColor}}; font-size: 2em; margin-bottom: 20px; }
        .code-block { background: #f8f9fa; padding: 20px; border-radius: 8px; font-family: 'Consolas', monospace; margin: 20px 0; }
        .highlight { background: {{primaryColor}}; color: white; padding: 2px 8px; border-radius: 4px; }
        .animation { transition: all 0.5s ease-in-out; }
        .speaker-notes { display: none; background: #fffbf0; border-left: 4px solid #ffc107; padding: 15px; margin-top: 30px; }
        .show-notes .speaker-notes { display: block; }
    </style>
    <script>
        function toggleNotes() {
            document.body.classList.toggle('show-notes');
        }
        function nextSlide() {
            // Navigation logic would go here
        }
        function prevSlide() {
            // Navigation logic would go here
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'n' || e.key === 'N') toggleNotes();
        });
    </script>
</head>
<body>
    <div class="slide">
        {{content}}
        {{#if speakerNotes}}
        <div class="speaker-notes">
            <strong>Speaker Notes:</strong> {{speakerNotes}}
        </div>
        {{/if}}
    </div>
</body>
</html>`;

    this.templates.set('slide', slideTemplate);

    // Module template
    const moduleTemplate = `# {{title}}

**Duration:** {{duration}} minutes  
**Difficulty:** {{difficulty}}  
**Category:** {{category}}

## Description
{{description}}

## Learning Objectives
{{#each learningObjectives}}
- {{this}}
{{/each}}

## Prerequisites
{{#each prerequisites}}
- {{this}}
{{/each}}

## Content
{{#each slides}}
### {{title}}
{{content}}
{{/each}}

## Exercises
{{#each exercises}}
### {{title}}
**Type:** {{type}}  
**Estimated Time:** {{estimatedTime}} minutes

{{description}}

#### Instructions
{{#each instructions}}
1. {{this}}
{{/each}}
{{/each}}

## Assessment
{{#if assessment}}
**Passing Score:** {{assessment.passingScore}}%  
**Time Limit:** {{assessment.timeLimit}} minutes
{{/if}}

## Resources
{{#each resources}}
- [{{title}}]({{url}}) - {{description}}
{{/each}}`;

    this.templates.set('module', moduleTemplate);
  }

  private loadModules(): void {
    console.log('📚 Loading training modules...');

    try {
      const moduleFiles = readdirSync(this.config.contentDir)
        .filter(file => file.startsWith('module-') && file.endsWith('.yml'));

      for (const file of moduleFiles) {
        const modulePath = join(this.config.contentDir, file);
        const content = readFileSync(modulePath, 'utf-8');
        const moduleData = yaml.parse(content) as TrainingModule;
        this.modules.set(moduleData.id, moduleData);
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      this.createSampleModules();
    }

    console.log(`✅ Loaded ${this.modules.size} training modules`);
  }

  private createSampleModules(): void {
    const sampleModules: TrainingModule[] = [
      {
        id: 'documentation-basics',
        title: 'Documentation Fundamentals',
        description: 'Learn the basics of creating effective technical documentation',
        category: 'documentation',
        difficulty: 'beginner',
        estimatedDuration: 45,
        prerequisites: [],
        learningObjectives: [
          'Understand documentation best practices',
          'Learn markdown syntax and formatting',
          'Create structured documentation',
          'Implement documentation workflows'
        ],
        content: {
          slides: [
            {
              id: 'intro',
              title: 'Welcome to Documentation Fundamentals',
              content: 'This module covers the essential skills for creating effective technical documentation.',
              type: 'intro',
              duration: 60,
              speakerNotes: 'Welcome participants and set expectations for the module.'
            },
            {
              id: 'best-practices',
              title: 'Documentation Best Practices',
              content: 'Key principles: clarity, completeness, consistency, and maintainability.',
              type: 'concept',
              duration: 180,
              speakerNotes: 'Explain each principle with examples from real documentation.',
              codeExamples: [
                {
                  language: 'markdown',
                  code: '# API Endpoint\\n\\n## POST /api/users\\n\\nCreates a new user account.\\n\\n### Parameters\\n\\n| Name | Type | Required | Description |\\n|------|------|----------|-------------|\\n| email | string | Yes | User email address |',
                  description: 'Example of well-structured API documentation',
                  executable: false
                }
              ]
            }
          ],
          exercises: [
            {
              id: 'markdown-practice',
              title: 'Markdown Formatting Exercise',
              description: 'Practice creating formatted documentation using markdown',
              type: 'hands-on',
              difficulty: 'easy',
              estimatedTime: 15,
              instructions: [
                'Create a README file for a sample project',
                'Include headers, lists, code blocks, and links',
                'Format tables for API parameters',
                'Add badges and images'
              ],
              resources: ['markdown-cheatsheet.pdf', 'sample-project-template'],
              solution: {
                description: 'A complete README with proper markdown formatting',
                steps: [
                  'Start with project title and description',
                  'Add installation instructions with code blocks',
                  'Include usage examples',
                  'Add contribution guidelines'
                ]
              }
            }
          ],
          assessments: [
            {
              id: 'doc-quiz',
              title: 'Documentation Knowledge Check',
              type: 'quiz',
              passingScore: 80,
              timeLimit: 10,
              questions: [
                {
                  id: 'q1',
                  type: 'multiple-choice',
                  question: 'Which of the following is NOT a key principle of good documentation?',
                  points: 10,
                  options: ['Clarity', 'Completeness', 'Creativity', 'Consistency'],
                  correctAnswer: 2,
                  explanation: 'While creativity can be helpful, it\'s not a core principle. The four key principles are clarity, completeness, consistency, and maintainability.'
                }
              ],
              feedback: {
                correct: 'Great job! You understand documentation principles.',
                incorrect: 'Please review the documentation best practices section.',
                partial: 'Good effort! Review the areas you missed.'
              }
            }
          ],
          resources: [
            {
              id: 'markdown-guide',
              title: 'Markdown Syntax Guide',
              type: 'document',
              url: '/resources/markdown-guide.pdf',
              description: 'Complete reference for markdown formatting',
              downloadable: true
            }
          ]
        },
        interactiveElements: [
          {
            id: 'markdown-editor',
            type: 'sandbox',
            title: 'Live Markdown Editor',
            description: 'Practice markdown syntax with live preview',
            config: {
              language: 'markdown',
              showPreview: true,
              theme: 'github'
            }
          }
        ],
        metadata: {
          author: 'Documentation Team',
          version: '1.0.0',
          createdAt: this.getDeterministicDate().toISOString(),
          updatedAt: this.getDeterministicDate().toISOString(),
          tags: ['documentation', 'markdown', 'writing', 'technical'],
          audience: ['developers', 'technical-writers', 'product-managers']
        }
      },
      {
        id: 'compliance-sox',
        title: 'SOX Compliance Training',
        description: 'Understanding Sarbanes-Oxley compliance requirements and implementation',
        category: 'compliance',
        difficulty: 'intermediate',
        estimatedDuration: 90,
        prerequisites: ['basic-compliance-awareness'],
        learningObjectives: [
          'Understand SOX compliance requirements',
          'Implement SOX controls',
          'Document compliance processes',
          'Handle SOX audits effectively'
        ],
        content: {
          slides: [
            {
              id: 'sox-overview',
              title: 'SOX Overview',
              content: 'The Sarbanes-Oxley Act of 2002 established new standards for public company boards, management, and public accounting firms.',
              type: 'intro',
              duration: 120
            }
          ],
          exercises: [],
          assessments: [],
          resources: []
        },
        interactiveElements: [],
        metadata: {
          author: 'Compliance Team',
          version: '1.0.0',
          createdAt: this.getDeterministicDate().toISOString(),
          updatedAt: this.getDeterministicDate().toISOString(),
          tags: ['compliance', 'sox', 'audit', 'finance'],
          audience: ['compliance-officers', 'managers', 'auditors']
        }
      }
    ];

    sampleModules.forEach(module => {
      this.modules.set(module.id, module);
      this.saveModule(module);
    });
  }

  private saveModule(module: TrainingModule): void {
    const moduleFile = join(this.config.contentDir, `module-${module.id}.yml`);
    writeFileSync(moduleFile, yaml.stringify(module, { indent: 2 }), 'utf-8');
  }

  private loadPrograms(): void {
    console.log('🎓 Loading training programs...');

    try {
      const programFiles = readdirSync(this.config.contentDir)
        .filter(file => file.startsWith('program-') && file.endsWith('.yml'));

      for (const file of programFiles) {
        const programPath = join(this.config.contentDir, file);
        const content = readFileSync(programPath, 'utf-8');
        const programData = yaml.parse(content) as TrainingProgram;
        this.programs.set(programData.id, programData);
      }
    } catch (error) {
      console.error('Error loading programs:', error);
    }

    console.log(`✅ Loaded ${this.programs.size} training programs`);
  }

  public async generateAllMaterials(): Promise<void> {
    console.log('🚀 Starting training materials generation...');

    const startTime = this.getDeterministicTimestamp();

    // Generate materials for each module
    for (const module of this.modules.values()) {
      await this.generateModuleMaterials(module);
    }

    // Generate program materials
    for (const program of this.programs.values()) {
      await this.generateProgramMaterials(program);
    }

    // Generate master index
    await this.generateMasterIndex();

    const duration = this.getDeterministicTimestamp() - startTime;
    console.log(`✅ Training materials generation completed in ${duration}ms`);
  }

  private async generateModuleMaterials(module: TrainingModule): Promise<void> {
    console.log(`📖 Generating materials for module: ${module.title}`);

    // Generate HTML presentation
    if (this.config.generateFormats.includes('html')) {
      await this.generateHTMLPresentation(module);
    }

    // Generate PDF handout
    if (this.config.generateFormats.includes('pdf')) {
      await this.generatePDFHandout(module);
    }

    // Generate video materials
    if (this.config.generateFormats.includes('video') && this.config.enableVideoGeneration) {
      await this.generateVideoMaterials(module);
    }

    // Generate SCORM package
    if (this.config.generateFormats.includes('scorm')) {
      await this.generateSCORMPackage(module);
    }

    // Generate interactive elements
    if (this.config.enableInteractiveContent) {
      await this.generateInteractiveContent(module);
    }
  }

  private async generateHTMLPresentation(module: TrainingModule): Promise<void> {
    const outputDir = join(this.config.outputDir, 'html', module.id);
    mkdirSync(outputDir, { recursive: true });

    // Generate index page
    const indexHTML = this.renderTemplate('presentation-index', {
      module,
      slides: module.content.slides,
      branding: this.config.branding,
      navigation: true
    });

    writeFileSync(join(outputDir, 'index.html'), indexHTML, 'utf-8');

    // Generate individual slide pages
    for (let i = 0; i < module.content.slides.length; i++) {
      const slide = module.content.slides[i];
      const slideHTML = this.renderTemplate('slide', {
        slide,
        module,
        slideNumber: i + 1,
        totalSlides: module.content.slides.length,
        nextSlide: i < module.content.slides.length - 1 ? `slide-${i + 2}.html` : null,
        prevSlide: i > 0 ? `slide-${i}.html` : null,
        branding: this.config.branding
      });

      writeFileSync(join(outputDir, `slide-${i + 1}.html`), slideHTML, 'utf-8');
    }

    // Copy CSS and JavaScript
    await this.copyAssets(outputDir);

    console.log(`📄 Generated HTML presentation: ${outputDir}`);
  }

  private async generatePDFHandout(module: TrainingModule): Promise<void> {
    const outputPath = join(this.config.outputDir, 'pdf', `${module.id}-handout.pdf`);
    
    // Generate markdown content
    const markdownContent = this.renderTemplate('module', {
      ...module,
      branding: this.config.branding
    });

    // Convert to PDF (would use pandoc or similar)
    try {
      await execAsync(`pandoc -o "${outputPath}" -f markdown -t pdf --pdf-engine=xelatex`, {
        input: markdownContent
      });
      console.log(`📄 Generated PDF handout: ${outputPath}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback: save as markdown
      const fallbackPath = join(this.config.outputDir, 'pdf', `${module.id}-handout.md`);
      writeFileSync(fallbackPath, markdownContent, 'utf-8');
      console.log(`📄 Generated Markdown handout: ${fallbackPath}`);
    }
  }

  private async generateVideoMaterials(module: TrainingModule): Promise<void> {
    if (!module.videoScript) {
      console.log(`⏭️  Skipping video generation for ${module.id} (no video script)`);
      return;
    }

    console.log(`🎬 Generating video materials for: ${module.title}`);

    const videoDir = join(this.config.videoOutputDir, module.id);
    mkdirSync(videoDir, { recursive: true });

    // Generate video script file
    const scriptContent = this.generateVideoScript(module);
    writeFileSync(join(videoDir, 'script.txt'), scriptContent, 'utf-8');

    // Generate subtitle files
    const subtitleContent = this.generateSubtitles(module.videoScript);
    writeFileSync(join(videoDir, 'subtitles.srt'), subtitleContent, 'utf-8');
    writeFileSync(join(videoDir, 'subtitles.vtt'), this.convertSRTtoVTT(subtitleContent), 'utf-8');

    // Generate scene markers
    const sceneMarkers = this.generateSceneMarkers(module.videoScript);
    writeFileSync(join(videoDir, 'scenes.json'), JSON.stringify(sceneMarkers, null, 2), 'utf-8');

    // Generate storyboard
    await this.generateStoryboard(module, videoDir);

    // Generate automated video (would integrate with video generation tools)
    if (this.config.videoSettings) {
      await this.generateAutomatedVideo(module, videoDir);
    }

    console.log(`🎬 Generated video materials: ${videoDir}`);
  }

  private generateVideoScript(module: TrainingModule): string {
    if (!module.videoScript) return '';

    let script = `# Video Script: ${module.title}\n\n`;
    script += `**Duration:** ${Math.floor(module.videoScript.duration / 60)}:${(module.videoScript.duration % 60).toString().padStart(2, '0')}\n\n`;
    script += `## Full Voiceover Text\n\n${module.videoScript.voiceoverText}\n\n`;
    
    script += `## Scene Breakdown\n\n`;
    module.videoScript.scenes.forEach((scene, index) => {
      script += `### Scene ${index + 1}: ${scene.title}\n`;
      script += `**Time:** ${this.formatTime(scene.startTime)} - ${this.formatTime(scene.endTime)}\n`;
      script += `**Description:** ${scene.description}\n`;
      script += `**Voiceover:** ${scene.voiceover}\n\n`;
    });

    return script;
  }

  private generateSubtitles(videoScript: VideoScript): string {
    let srtContent = '';
    
    videoScript.subtitles.forEach((subtitle, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${this.formatSRTTime(subtitle.startTime)} --> ${this.formatSRTTime(subtitle.endTime)}\n`;
      srtContent += `${subtitle.text}\n\n`;
    });

    return srtContent;
  }

  private convertSRTtoVTT(srtContent: string): string {
    return 'WEBVTT\n\n' + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((remainingSeconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(remainingSeconds).toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private generateSceneMarkers(videoScript: VideoScript): any {
    return {
      scenes: videoScript.scenes.map(scene => ({
        id: scene.id,
        title: scene.title,
        startTime: scene.startTime,
        endTime: scene.endTime,
        duration: scene.endTime - scene.startTime
      })),
      callToActions: videoScript.callToActions.map(cta => ({
        time: cta.time,
        type: cta.type,
        text: cta.text,
        url: cta.url,
        action: cta.action
      }))
    };
  }

  private async generateStoryboard(module: TrainingModule, outputDir: string): Promise<void> {
    if (!module.videoScript) return;

    let storyboard = `# Storyboard: ${module.title}\n\n`;
    
    module.videoScript.scenes.forEach((scene, index) => {
      storyboard += `## Scene ${index + 1}: ${scene.title}\n\n`;
      storyboard += `**Time:** ${this.formatTime(scene.startTime)} - ${this.formatTime(scene.endTime)}\n`;
      storyboard += `**Duration:** ${scene.endTime - scene.startTime} seconds\n\n`;
      storyboard += `**Visual Description:** ${scene.description}\n\n`;
      
      if (scene.screenCapture) {
        storyboard += `**Screen Capture:** Yes\n`;
      }
      
      if (scene.slides && scene.slides.length > 0) {
        storyboard += `**Slides:** ${scene.slides.join(', ')}\n`;
      }
      
      storyboard += `**Voiceover:** ${scene.voiceover}\n\n`;
      storyboard += `---\n\n`;
    });

    writeFileSync(join(outputDir, 'storyboard.md'), storyboard, 'utf-8');
  }

  private async generateAutomatedVideo(module: TrainingModule, outputDir: string): Promise<void> {
    // This would integrate with video generation tools like FFmpeg, Lottie, or specialized services
    console.log(`🎥 Generating automated video for ${module.title}`);
    
    // Example command structure (would be implemented based on chosen tools)
    const videoConfig = {
      resolution: this.config.videoSettings.resolution,
      frameRate: this.config.videoSettings.frameRate,
      format: this.config.videoSettings.format,
      outputPath: join(outputDir, `${module.id}.${this.config.videoSettings.format}`)
    };
    
    // Save video generation config
    writeFileSync(join(outputDir, 'video-config.json'), JSON.stringify(videoConfig, null, 2), 'utf-8');
    
    console.log(`📹 Video generation config saved: ${outputDir}`);
  }

  private async generateSCORMPackage(module: TrainingModule): Promise<void> {
    const scormDir = join(this.config.outputDir, 'scorm', module.id);
    mkdirSync(scormDir, { recursive: true });

    // Generate SCORM manifest
    const manifest = this.generateSCORMManifest(module);
    writeFileSync(join(scormDir, 'imsmanifest.xml'), manifest, 'utf-8');

    // Generate content pages
    await this.generateSCORMContent(module, scormDir);

    // Create SCORM package
    await this.createSCORMPackage(scormDir);

    console.log(`📦 Generated SCORM package: ${scormDir}`);
  }

  private generateSCORMManifest(module: TrainingModule): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${module.id}" version="1.0" 
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  
  <organizations default="${module.id}_org">
    <organization identifier="${module.id}_org">
      <title>${module.title}</title>
      <item identifier="${module.id}_item" identifierref="${module.id}_resource">
        <title>${module.title}</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  
  <resources>
    <resource identifier="${module.id}_resource" type="webcontent" 
              adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
      ${module.content.slides.map((_, index) => `<file href="slide-${index + 1}.html"/>`).join('\n      ')}
    </resource>
  </resources>
</manifest>`;
  }

  private async generateSCORMContent(module: TrainingModule, scormDir: string): Promise<void> {
    // Generate SCORM-compliant HTML pages
    const scormHTML = this.generateSCORMHTML(module);
    writeFileSync(join(scormDir, 'index.html'), scormHTML, 'utf-8');

    // Copy necessary SCORM API files
    await this.copySCORMAssets(scormDir);
  }

  private generateSCORMHTML(module: TrainingModule): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>${module.title}</title>
    <script src="SCORM_API_wrapper.js"></script>
    <script>
        function initializeSCORM() {
            var success = doLMSInitialize();
            if (success) {
                doLMSSetValue("cmi.core.lesson_status", "incomplete");
                doLMSCommit();
            }
        }
        
        function finishSCORM() {
            doLMSSetValue("cmi.core.lesson_status", "completed");
            doLMSSetValue("cmi.core.score.raw", "100");
            doLMSCommit();
            doLMSFinish();
        }
        
        window.onload = initializeSCORM;
        window.onunload = finishSCORM;
    </script>
</head>
<body>
    <h1>${module.title}</h1>
    <div id="content">
        ${module.content.slides.map(slide => `
            <div class="slide">
                <h2>${slide.title}</h2>
                <div>${slide.content}</div>
            </div>
        `).join('')}
    </div>
    <button onclick="finishSCORM()">Complete Course</button>
</body>
</html>`;
  }

  private async copySCORMAssets(scormDir: string): Promise<void> {
    // Copy SCORM API wrapper and other required files
    // This would copy from a SCORM template directory
    console.log(`📁 Copying SCORM assets to ${scormDir}`);
  }

  private async createSCORMPackage(scormDir: string): Promise<void> {
    // Create ZIP package for SCORM
    try {
      const packagePath = `${scormDir}.zip`;
      await execAsync(`cd "${dirname(scormDir)}" && zip -r "${packagePath}" "${basename(scormDir)}"`);
      console.log(`📦 Created SCORM package: ${packagePath}`);
    } catch (error) {
      console.error('Error creating SCORM package:', error);
    }
  }

  private async generateInteractiveContent(module: TrainingModule): Promise<void> {
    const interactiveDir = join(this.config.outputDir, 'interactive', module.id);
    mkdirSync(interactiveDir, { recursive: true });

    for (const element of module.interactiveElements) {
      await this.generateInteractiveElement(element, interactiveDir);
    }

    console.log(`🎮 Generated interactive content: ${interactiveDir}`);
  }

  private async generateInteractiveElement(element: InteractiveElement, outputDir: string): Promise<void> {
    switch (element.type) {
      case 'sandbox':
        await this.generateCodeSandbox(element, outputDir);
        break;
      case 'simulation':
        await this.generateSimulation(element, outputDir);
        break;
      case 'demo':
        await this.generateInteractiveDemo(element, outputDir);
        break;
      case 'calculator':
        await this.generateCalculator(element, outputDir);
        break;
      case 'workflow-builder':
        await this.generateWorkflowBuilder(element, outputDir);
        break;
      case 'decision-tree':
        await this.generateDecisionTree(element, outputDir);
        break;
    }
  }

  private async generateCodeSandbox(element: InteractiveElement, outputDir: string): Promise<void> {
    const sandboxHTML = `<!DOCTYPE html>
<html>
<head>
    <title>${element.title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .editor-container { display: flex; height: 400px; }
        .editor { flex: 1; border: 1px solid #ccc; }
        .output { flex: 1; border: 1px solid #ccc; background: #f5f5f5; padding: 10px; overflow-y: auto; }
        .controls { margin: 10px 0; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; margin-right: 10px; }
    </style>
</head>
<body>
    <h1>${element.title}</h1>
    <p>${element.description}</p>
    
    <div class="controls">
        <button onclick="runCode()">Run Code</button>
        <button onclick="resetCode()">Reset</button>
    </div>
    
    <div class="editor-container">
        <div class="editor" id="editor"></div>
        <div class="output" id="output">
            <p>Click "Run Code" to execute your code</p>
        </div>
    </div>

    <script>
        const editor = CodeMirror(document.getElementById('editor'), {
            mode: '${element.config.language || 'javascript'}',
            theme: '${element.config.theme || 'default'}',
            lineNumbers: true,
            value: \`// Try some code here
console.log('Hello, World!');

// Example: Create a simple function
function greet(name) {
    return 'Hello, ' + name + '!';
}

console.log(greet('Learner'));\`
        });

        function runCode() {
            const code = editor.getValue();
            const output = document.getElementById('output');
            output.innerHTML = '<p>Running...</p>';
            
            try {
                // Capture console output
                const logs = [];
                const originalLog = console.log;
                console.log = (...args) => {
                    logs.push(args.join(' '));
                    originalLog.apply(console, args);
                };
                
                eval(code);
                
                console.log = originalLog;
                output.innerHTML = logs.map(log => \`<div>\${log}</div>\`).join('');
            } catch (error) {
                output.innerHTML = \`<div style="color: red;">Error: \${error.message}</div>\`;
            }
        }

        function resetCode() {
            editor.setValue(\`// Try some code here
console.log('Hello, World!');\`);
            document.getElementById('output').innerHTML = '<p>Click "Run Code" to execute your code</p>';
        }
    </script>
</body>
</html>`;

    writeFileSync(join(outputDir, `${element.id}.html`), sandboxHTML, 'utf-8');
  }

  private async generateSimulation(element: InteractiveElement, outputDir: string): Promise<void> {
    // Generate interactive simulation
    console.log(`🎮 Generating simulation: ${element.title}`);
  }

  private async generateInteractiveDemo(element: InteractiveElement, outputDir: string): Promise<void> {
    // Generate interactive demo
    console.log(`🎪 Generating demo: ${element.title}`);
  }

  private async generateCalculator(element: InteractiveElement, outputDir: string): Promise<void> {
    // Generate interactive calculator
    console.log(`🧮 Generating calculator: ${element.title}`);
  }

  private async generateWorkflowBuilder(element: InteractiveElement, outputDir: string): Promise<void> {
    // Generate workflow builder interface
    console.log(`⚙️ Generating workflow builder: ${element.title}`);
  }

  private async generateDecisionTree(element: InteractiveElement, outputDir: string): Promise<void> {
    // Generate decision tree interface
    console.log(`🌳 Generating decision tree: ${element.title}`);
  }

  private async generateProgramMaterials(program: TrainingProgram): Promise<void> {
    console.log(`🎓 Generating materials for program: ${program.title}`);

    const programDir = join(this.config.outputDir, 'programs', program.id);
    mkdirSync(programDir, { recursive: true });

    // Generate program overview
    const overviewContent = this.generateProgramOverview(program);
    writeFileSync(join(programDir, 'overview.md'), overviewContent, 'utf-8');

    // Generate curriculum guide
    const curriculumContent = this.generateCurriculumGuide(program);
    writeFileSync(join(programDir, 'curriculum.md'), curriculumContent, 'utf-8');

    // Generate certificates
    if (program.certification) {
      await this.generateCertificateTemplate(program, programDir);
    }

    // Generate completion tracking
    const trackingContent = this.generateProgressTracking(program);
    writeFileSync(join(programDir, 'progress-tracking.json'), trackingContent, 'utf-8');
  }

  private generateProgramOverview(program: TrainingProgram): string {
    const modules = program.modules.map(id => this.modules.get(id)).filter(Boolean);
    
    let content = `# ${program.title}\n\n`;
    content += `${program.description}\n\n`;
    content += `**Total Duration:** ${program.totalDuration} minutes\n`;
    content += `**Number of Modules:** ${program.modules.length}\n\n`;

    if (program.certification) {
      content += `## Certification\n\n`;
      content += `**Certificate:** ${program.certification.name}\n`;
      content += `**Validity Period:** ${program.certification.validityPeriod} months\n\n`;
      content += `### Requirements\n`;
      program.certification.requirements.forEach(req => {
        content += `- ${req}\n`;
      });
      content += '\n';
    }

    content += `## Modules\n\n`;
    modules.forEach((module, index) => {
      if (module) {
        content += `### ${index + 1}. ${module.title}\n`;
        content += `**Duration:** ${module.estimatedDuration} minutes\n`;
        content += `**Difficulty:** ${module.difficulty}\n`;
        content += `${module.description}\n\n`;
      }
    });

    return content;
  }

  private generateCurriculumGuide(program: TrainingProgram): string {
    let guide = `# ${program.title} - Curriculum Guide\n\n`;
    
    if (program.schedule) {
      guide += `## Schedule Type: ${program.schedule.type}\n\n`;
      
      if (program.schedule.sessions) {
        guide += `### Sessions\n\n`;
        program.schedule.sessions.forEach((session, index) => {
          guide += `#### Session ${index + 1}: ${session.title}\n`;
          guide += `**Date:** ${session.date}\n`;
          guide += `**Duration:** ${session.duration} minutes\n`;
          if (session.instructor) guide += `**Instructor:** ${session.instructor}\n`;
          if (session.maxParticipants) guide += `**Max Participants:** ${session.maxParticipants}\n`;
          guide += `**Modules:** ${session.moduleIds.join(', ')}\n\n`;
        });
      }
    }

    return guide;
  }

  private async generateCertificateTemplate(program: TrainingProgram, outputDir: string): Promise<void> {
    const certificateHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Certificate - ${program.certification!.name}</title>
    <style>
        body { font-family: 'Times New Roman', serif; text-align: center; padding: 50px; background: #f9f9f9; }
        .certificate { background: white; border: 10px solid #${this.config.branding.colors.primary}; padding: 60px; max-width: 800px; margin: 0 auto; }
        .header { font-size: 2.5em; color: #${this.config.branding.colors.primary}; margin-bottom: 30px; }
        .title { font-size: 2em; margin: 30px 0; }
        .recipient { font-size: 1.5em; font-weight: bold; margin: 40px 0; padding: 20px; border-bottom: 2px solid #ccc; }
        .program { font-size: 1.3em; margin: 30px 0; }
        .date { margin: 40px 0; }
        .signature { margin-top: 60px; display: flex; justify-content: space-around; }
        .signature div { text-align: center; }
        .signature-line { border-bottom: 1px solid #333; width: 200px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">CERTIFICATE OF COMPLETION</div>
        
        <div class="title">This certifies that</div>
        
        <div class="recipient">{{PARTICIPANT_NAME}}</div>
        
        <div class="title">has successfully completed</div>
        
        <div class="program">${program.title}</div>
        
        <div class="date">
            Completed on: {{COMPLETION_DATE}}<br>
            Total Duration: ${program.totalDuration} minutes
        </div>
        
        <div class="signature">
            <div>
                <div class="signature-line"></div>
                <div>Program Director</div>
            </div>
            <div>
                <div class="signature-line"></div>
                <div>Training Manager</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    writeFileSync(join(outputDir, 'certificate-template.html'), certificateHTML, 'utf-8');
  }

  private generateProgressTracking(program: TrainingProgram): string {
    const trackingSchema = {
      programId: program.id,
      modules: program.modules.map(moduleId => {
        const module = this.modules.get(moduleId);
        return {
          moduleId,
          title: module?.title || 'Unknown Module',
          estimatedDuration: module?.estimatedDuration || 0,
          completed: false,
          completedAt: null,
          score: null,
          timeSpent: 0
        };
      }),
      overallProgress: {
        completed: false,
        completedAt: null,
        totalTimeSpent: 0,
        overallScore: null,
        certificateIssued: false,
        certificateIssuedAt: null
      }
    };

    return JSON.stringify(trackingSchema, null, 2);
  }

  private async generateMasterIndex(): Promise<void> {
    console.log('📋 Generating master training index...');

    const indexContent = {
      metadata: {
        generatedAt: this.getDeterministicDate().toISOString(),
        totalModules: this.modules.size,
        totalPrograms: this.programs.size,
        generatedFormats: this.config.generateFormats
      },
      modules: Array.from(this.modules.values()).map(module => ({
        id: module.id,
        title: module.title,
        category: module.category,
        difficulty: module.difficulty,
        duration: module.estimatedDuration,
        formats: this.config.generateFormats.map(format => ({
          format,
          path: this.getModuleFormatPath(module.id, format)
        }))
      })),
      programs: Array.from(this.programs.values()).map(program => ({
        id: program.id,
        title: program.title,
        totalDuration: program.totalDuration,
        moduleCount: program.modules.length,
        certification: program.certification?.name
      })),
      categories: this.getCategoryStats(),
      formats: this.getFormatStats()
    };

    writeFileSync(
      join(this.config.outputDir, 'training-index.json'), 
      JSON.stringify(indexContent, null, 2), 
      'utf-8'
    );

    // Generate HTML index
    const htmlIndex = this.generateHTMLIndex(indexContent);
    writeFileSync(join(this.config.outputDir, 'index.html'), htmlIndex, 'utf-8');

    console.log('✅ Generated master training index');
  }

  private getModuleFormatPath(moduleId: string, format: string): string {
    switch (format) {
      case 'html':
        return `html/${moduleId}/index.html`;
      case 'pdf':
        return `pdf/${moduleId}-handout.pdf`;
      case 'video':
        return `video/${moduleId}/${moduleId}.mp4`;
      case 'scorm':
        return `scorm/${moduleId}.zip`;
      default:
        return `${format}/${moduleId}`;
    }
  }

  private getCategoryStats(): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const module of this.modules.values()) {
      categories[module.category] = (categories[module.category] || 0) + 1;
    }
    return categories;
  }

  private getFormatStats(): Record<string, number> {
    const formatCounts: Record<string, number> = {};
    this.config.generateFormats.forEach(format => {
      formatCounts[format] = this.modules.size;
    });
    return formatCounts;
  }

  private generateHTMLIndex(indexData: any): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Training Materials Index</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 40px; color: #${this.config.branding.colors.primary}; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #${this.config.branding.colors.primary}; }
        .modules, .programs { margin-bottom: 40px; }
        .module-card, .program-card { border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
        .module-title, .program-title { font-size: 1.3em; font-weight: bold; margin-bottom: 10px; }
        .module-meta, .program-meta { color: #666; margin-bottom: 15px; }
        .formats { display: flex; gap: 10px; flex-wrap: wrap; }
        .format-link { background: #${this.config.branding.colors.primary}; color: white; padding: 5px 15px; border-radius: 4px; text-decoration: none; }
        .format-link:hover { opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Training Materials</h1>
            <p>Generated on ${this.getDeterministicDate().toLocaleDateString()}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${indexData.metadata.totalModules}</div>
                <div>Training Modules</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${indexData.metadata.totalPrograms}</div>
                <div>Training Programs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${indexData.metadata.generatedFormats.length}</div>
                <div>Output Formats</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(indexData.categories).length}</div>
                <div>Categories</div>
            </div>
        </div>

        <div class="modules">
            <h2>📖 Training Modules</h2>
            ${indexData.modules.map((module: any) => `
                <div class="module-card">
                    <div class="module-title">${module.title}</div>
                    <div class="module-meta">
                        <strong>Category:</strong> ${module.category} |
                        <strong>Difficulty:</strong> ${module.difficulty} |
                        <strong>Duration:</strong> ${module.duration} minutes
                    </div>
                    <div class="formats">
                        ${module.formats.map((format: any) => `
                            <a href="${format.path}" class="format-link">${format.format.toUpperCase()}</a>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="programs">
            <h2>🎓 Training Programs</h2>
            ${indexData.programs.map((program: any) => `
                <div class="program-card">
                    <div class="program-title">${program.title}</div>
                    <div class="program-meta">
                        <strong>Duration:</strong> ${program.totalDuration} minutes |
                        <strong>Modules:</strong> ${program.moduleCount}
                        ${program.certification ? ` | <strong>Certification:</strong> ${program.certification}` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  private renderTemplate(templateName: string, data: any): string {
    const template = this.templates.get(templateName) || '';
    
    // Simple template rendering (would use a proper template engine in production)
    let rendered = template;
    
    // Replace simple variables
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, data[key]);
    });

    // Handle arrays and objects (basic implementation)
    if (data.slides) {
      const slidesHTML = data.slides.map((slide: any, index: number) => `
        <div class="slide" data-slide="${index + 1}">
          <h2>${slide.title}</h2>
          <div class="slide-content">${slide.content}</div>
        </div>
      `).join('');
      rendered = rendered.replace('{{slides}}', slidesHTML);
    }

    return rendered;
  }

  private async copyAssets(outputDir: string): Promise<void> {
    // Copy CSS, JavaScript, and other assets
    console.log(`📁 Copying assets to ${outputDir}`);
  }

  public getModules(): TrainingModule[] {
    return Array.from(this.modules.values());
  }

  public getPrograms(): TrainingProgram[] {
    return Array.from(this.programs.values());
  }

  public addModule(module: TrainingModule): void {
    this.modules.set(module.id, module);
    this.saveModule(module);
  }

  public updateModule(id: string, updates: Partial<TrainingModule>): boolean {
    const module = this.modules.get(id);
    if (!module) return false;

    const updatedModule = { ...module, ...updates };
    this.modules.set(id, updatedModule);
    this.saveModule(updatedModule);
    return true;
  }

  public deleteModule(id: string): boolean {
    return this.modules.delete(id);
  }
}

// CLI interface
if (require.main === module) {
  const config: TrainingGeneratorConfig = {
    contentDir: process.env.TRAINING_CONTENT_DIR || 'docs/training',
    outputDir: process.env.TRAINING_OUTPUT_DIR || 'docs/training-output',
    templatesDir: process.env.TRAINING_TEMPLATES_DIR || 'docs/training/templates',
    mediaDir: process.env.TRAINING_MEDIA_DIR || 'docs/training/media',
    videoOutputDir: process.env.VIDEO_OUTPUT_DIR || 'docs/training-output/videos',
    enableVideoGeneration: process.env.ENABLE_VIDEO_GENERATION === 'true',
    enableInteractiveContent: process.env.ENABLE_INTERACTIVE_CONTENT !== 'false',
    videoSettings: {
      resolution: (process.env.VIDEO_RESOLUTION as '720p' | '1080p' | '4K') || '1080p',
      frameRate: parseInt(process.env.VIDEO_FRAME_RATE || '30'),
      bitRate: process.env.VIDEO_BITRATE || '2000k',
      format: (process.env.VIDEO_FORMAT as 'mp4' | 'webm' | 'avi') || 'mp4'
    },
    slideSettings: {
      theme: process.env.SLIDE_THEME || 'professional',
      aspectRatio: (process.env.SLIDE_ASPECT_RATIO as '16:9' | '4:3' | '21:9') || '16:9',
      transitionSpeed: parseInt(process.env.TRANSITION_SPEED || '500'),
      fontFamily: process.env.SLIDE_FONT_FAMILY || 'Arial, sans-serif'
    },
    generateFormats: (process.env.GENERATE_FORMATS || 'html,pdf').split(',') as ('html' | 'pdf' | 'pptx' | 'video' | 'scorm')[],
    languages: (process.env.SUPPORTED_LANGUAGES || 'en').split(','),
    reviewReminderDays: parseInt(process.env.REVIEW_REMINDER_DAYS || '90'),
    branding: {
      colors: {
        primary: process.env.BRAND_PRIMARY_COLOR || '007bff',
        secondary: process.env.BRAND_SECONDARY_COLOR || '6c757d',
        background: process.env.BRAND_BACKGROUND_COLOR || 'ffffff',
        text: process.env.BRAND_TEXT_COLOR || '333333'
      },
      fonts: {
        heading: process.env.BRAND_HEADING_FONT || 'Arial, sans-serif',
        body: process.env.BRAND_BODY_FONT || 'Arial, sans-serif',
        code: process.env.BRAND_CODE_FONT || 'Consolas, monospace'
      }
    }
  };

  const generator = new TrainingMaterialsGenerator(config);

  // Generate all training materials
  generator.generateAllMaterials().then(() => {
    console.log('\n✅ Training materials generation complete!');
    console.log(`📁 Output directory: ${config.outputDir}`);
    console.log(`📖 Total modules: ${generator.getModules().length}`);
    console.log(`🎓 Total programs: ${generator.getPrograms().length}`);
  }).catch(error => {
    console.error('❌ Error generating training materials:', error);
    process.exit(1);
  });
}