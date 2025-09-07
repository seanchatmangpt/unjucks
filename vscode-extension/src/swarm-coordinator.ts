import * as vscode from 'vscode';
import { MCPIntegration, MCPAgent, SwarmStatus } from './mcp-integration';
import { TemplateItem } from './template-browser';

export interface SwarmTask {
    id: string;
    description: string;
    type: 'generation' | 'analysis' | 'optimization' | 'validation';
    status: 'pending' | 'running' | 'completed' | 'failed';
    assignedAgents: string[];
    startTime?: number;
    endTime?: number;
    results?: any;
    progress: number;
}

export interface AgentAssignment {
    agentId: string;
    role: string;
    capability: string;
    taskPortion: string;
    dependencies: string[];
}

export class SwarmCoordinator implements vscode.Disposable {
    private swarmTasks: Map<string, SwarmTask> = new Map();
    private agentPerformance: Map<string, AgentPerformanceMetrics> = new Map();
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;
    private treeProvider: SwarmTreeProvider;

    constructor(
        private context: vscode.ExtensionContext,
        private mcpIntegration: MCPIntegration
    ) {
        this.outputChannel = vscode.window.createOutputChannel('Unjucks Swarm');
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            96
        );
        this.treeProvider = new SwarmTreeProvider(this);
        
        this.setupTreeView();
        this.registerCommands();
    }

    async startSwarm(task?: string): Promise<void> {
        try {
            if (!task) {
                task = await vscode.window.showInputBox({
                    prompt: 'Describe the task for the AI swarm',
                    placeHolder: 'e.g., Generate a complete React component with tests',
                    ignoreFocusOut: true
                });
                
                if (!task) {
                    return;
                }
            }

            // Show swarm configuration options
            const config = await this.showSwarmConfiguration();
            if (!config) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Starting AI Swarm...",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 10, message: "Initializing swarm" });
                
                // Initialize swarm if not already done
                const swarmId = await this.mcpIntegration.initializeSwarm();
                
                if (token.isCancellationRequested) {
                    return;
                }
                
                progress.report({ increment: 30, message: "Spawning agents" });
                
                // Spawn required agents based on task complexity
                const agents = await this.spawnOptimalAgents(task, config);
                
                if (token.isCancellationRequested) {
                    return;
                }
                
                progress.report({ increment: 50, message: "Creating task assignments" });
                
                // Create swarm task
                const swarmTask = await this.createSwarmTask(task, agents, config);
                
                progress.report({ increment: 70, message: "Starting coordination" });
                
                // Execute the task with swarm coordination
                await this.executeSwarmTask(swarmTask);
                
                progress.report({ increment: 100, message: "Swarm active" });
            });

            await vscode.commands.executeCommand('setContext', 'unjucks:swarmActive', true);
            this.updateStatusBar('Swarm Active', 'active');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start swarm: ${error}`);
            this.outputChannel.appendLine(`Swarm start error: ${error}`);
        }
    }

    async generateWithSwarm(
        template: TemplateItem, 
        variables: Record<string, any>, 
        targetPath: string
    ): Promise<void> {
        const taskDescription = `Generate template "${template.label}" with variables ${JSON.stringify(variables)} to ${targetPath}`;
        
        // Create specialized task for template generation
        const agents = await this.spawnTemplateGenerationAgents(template);
        const swarmTask = await this.createSwarmTask(taskDescription, agents, {
            strategy: 'parallel',
            coordination: 'high',
            validation: true
        });
        
        // Add template-specific context
        swarmTask.results = {
            template,
            variables,
            targetPath,
            generatedFiles: []
        };

        await this.executeSwarmTask(swarmTask);
    }

    async getSwarmStatus(): Promise<SwarmStatus | undefined> {
        return await this.mcpIntegration.getSwarmStatus();
    }

    async getActiveTasks(): Promise<SwarmTask[]> {
        return Array.from(this.swarmTasks.values())
            .filter(task => task.status === 'running' || task.status === 'pending');
    }

    async pauseSwarm(): Promise<void> {
        const activeTasks = await this.getActiveTasks();
        
        if (activeTasks.length === 0) {
            vscode.window.showInformationMessage('No active swarm tasks to pause');
            return;
        }

        const action = await vscode.window.showWarningMessage(
            `Pause ${activeTasks.length} active task(s)?`,
            'Pause All',
            'Cancel'
        );
        
        if (action === 'Pause All') {
            for (const task of activeTasks) {
                task.status = 'pending';
            }
            
            this.updateStatusBar('Swarm Paused', 'paused');
            vscode.window.showInformationMessage('Swarm tasks paused');
        }
    }

    async resumeSwarm(): Promise<void> {
        const pausedTasks = Array.from(this.swarmTasks.values())
            .filter(task => task.status === 'pending');
            
        if (pausedTasks.length === 0) {
            vscode.window.showInformationMessage('No paused tasks to resume');
            return;
        }

        for (const task of pausedTasks) {
            await this.executeSwarmTask(task);
        }
        
        this.updateStatusBar('Swarm Active', 'active');
        vscode.window.showInformationMessage(`Resumed ${pausedTasks.length} task(s)`);
    }

    async stopSwarm(): Promise<void> {
        const activeTasks = await this.getActiveTasks();
        
        if (activeTasks.length === 0) {
            vscode.window.showInformationMessage('No active swarm to stop');
            return;
        }

        const action = await vscode.window.showWarningMessage(
            `Stop swarm and cancel ${activeTasks.length} task(s)?`,
            'Stop Swarm',
            'Cancel'
        );
        
        if (action === 'Stop Swarm') {
            // Mark all tasks as failed
            for (const task of activeTasks) {
                task.status = 'failed';
                task.endTime = Date.now();
            }
            
            await vscode.commands.executeCommand('setContext', 'unjucks:swarmActive', false);
            this.updateStatusBar('Swarm Stopped', 'stopped');
            this.swarmTasks.clear();
            
            vscode.window.showInformationMessage('Swarm stopped');
        }
    }

    private async showSwarmConfiguration(): Promise<any> {
        const strategies = ['Adaptive', 'Parallel', 'Sequential', 'Hierarchical'];
        const coordination = ['Low', 'Medium', 'High'];
        const validation = ['None', 'Basic', 'Comprehensive'];

        const strategy = await vscode.window.showQuickPick(strategies, {
            placeHolder: 'Select coordination strategy'
        });
        
        if (!strategy) return undefined;

        const coord = await vscode.window.showQuickPick(coordination, {
            placeHolder: 'Select coordination level'
        });
        
        if (!coord) return undefined;

        const valid = await vscode.window.showQuickPick(validation, {
            placeHolder: 'Select validation level'
        });
        
        if (!valid) return undefined;

        return {
            strategy: strategy.toLowerCase(),
            coordination: coord.toLowerCase(),
            validation: valid !== 'None'
        };
    }

    private async spawnOptimalAgents(task: string, config: any): Promise<MCPAgent[]> {
        const agents: MCPAgent[] = [];
        
        // Analyze task to determine required agent types
        const requiredAgents = this.analyzeTaskRequirements(task);
        
        this.outputChannel.appendLine(`Spawning ${requiredAgents.length} agents for task`);
        
        for (const agentType of requiredAgents) {
            try {
                const agent = await this.mcpIntegration.spawnAgent(agentType);
                agents.push(agent);
                this.outputChannel.appendLine(`Spawned ${agentType} agent: ${agent.id}`);
            } catch (error) {
                this.outputChannel.appendLine(`Failed to spawn ${agentType} agent: ${error}`);
            }
        }

        return agents;
    }

    private async spawnTemplateGenerationAgents(template: TemplateItem): Promise<MCPAgent[]> {
        const agents: MCPAgent[] = [];
        
        // Always need a coder for generation
        agents.push(await this.mcpIntegration.spawnAgent('coder', ['template-rendering', 'file-generation']));
        
        // Add tester if template has tests
        if (template.variables.some(v => v.name.includes('test'))) {
            agents.push(await this.mcpIntegration.spawnAgent('tester', ['template-testing', 'validation']));
        }
        
        // Add reviewer for complex templates
        if (template.complexity > 3) {
            agents.push(await this.mcpIntegration.spawnAgent('reviewer', ['code-review', 'quality-assurance']));
        }
        
        // Add architect for very complex templates
        if (template.complexity > 4) {
            agents.push(await this.mcpIntegration.spawnAgent('architect', ['system-design', 'template-architecture']));
        }

        return agents;
    }

    private analyzeTaskRequirements(task: string): string[] {
        const taskLower = task.toLowerCase();
        const requiredAgents: string[] = [];
        
        // Always need a coordinator for multi-agent tasks
        requiredAgents.push('coordinator');
        
        // Determine specific agent needs
        if (taskLower.includes('component') || taskLower.includes('generate') || taskLower.includes('create')) {
            requiredAgents.push('coder');
        }
        
        if (taskLower.includes('test') || taskLower.includes('validate')) {
            requiredAgents.push('tester');
        }
        
        if (taskLower.includes('review') || taskLower.includes('quality') || taskLower.includes('optimize')) {
            requiredAgents.push('reviewer');
        }
        
        if (taskLower.includes('research') || taskLower.includes('analyze') || taskLower.includes('investigate')) {
            requiredAgents.push('researcher');
        }
        
        if (taskLower.includes('architect') || taskLower.includes('design') || taskLower.includes('structure')) {
            requiredAgents.push('architect');
        }
        
        // Ensure minimum viable swarm
        if (requiredAgents.length < 2) {
            requiredAgents.push('coder');
        }

        return requiredAgents;
    }

    private async createSwarmTask(
        description: string, 
        agents: MCPAgent[], 
        config: any
    ): Promise<SwarmTask> {
        const taskId = this.generateTaskId();
        
        const swarmTask: SwarmTask = {
            id: taskId,
            description,
            type: this.inferTaskType(description),
            status: 'pending',
            assignedAgents: agents.map(a => a.id),
            progress: 0
        };
        
        this.swarmTasks.set(taskId, swarmTask);
        this.treeProvider.refresh();
        
        return swarmTask;
    }

    private async executeSwarmTask(task: SwarmTask): Promise<void> {
        try {
            task.status = 'running';
            task.startTime = Date.now();
            
            this.outputChannel.appendLine(`Starting task: ${task.description}`);
            this.treeProvider.refresh();
            
            // Orchestrate the task using MCP
            const mcpTaskId = await this.mcpIntegration.orchestrateTask(task.description, {
                strategy: 'adaptive',
                priority: 'high',
                maxAgents: task.assignedAgents.length
            });
            
            // Monitor task progress
            await this.monitorTaskProgress(task, mcpTaskId);
            
        } catch (error) {
            task.status = 'failed';
            task.endTime = Date.now();
            this.outputChannel.appendLine(`Task failed: ${error}`);
            
            vscode.window.showErrorMessage(`Swarm task failed: ${error}`);
        } finally {
            this.treeProvider.refresh();
        }
    }

    private async monitorTaskProgress(task: SwarmTask, mcpTaskId: string): Promise<void> {
        const maxAttempts = 60; // 5 minutes max
        let attempts = 0;
        
        while (attempts < maxAttempts && task.status === 'running') {
            try {
                const status = await this.mcpIntegration.getTaskStatus(mcpTaskId);
                
                if (status.completed) {
                    const results = await this.mcpIntegration.getTaskResults(mcpTaskId);
                    task.results = results;
                    task.status = 'completed';
                    task.endTime = Date.now();
                    task.progress = 100;
                    
                    this.outputChannel.appendLine(`Task completed: ${task.description}`);
                    this.updateAgentPerformance(task);
                    
                    vscode.window.showInformationMessage(
                        `Swarm task completed: ${task.description.substring(0, 50)}...`
                    );
                    break;
                } else if (status.failed) {
                    task.status = 'failed';
                    task.endTime = Date.now();
                    break;
                } else {
                    // Update progress
                    task.progress = Math.min(95, status.progress || 0);
                    this.treeProvider.refresh();
                }
                
            } catch (error) {
                this.outputChannel.appendLine(`Error monitoring task: ${error}`);
            }
            
            // Wait 5 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        // Timeout handling
        if (attempts >= maxAttempts && task.status === 'running') {
            task.status = 'failed';
            task.endTime = Date.now();
            this.outputChannel.appendLine(`Task timed out: ${task.description}`);
        }
    }

    private updateAgentPerformance(task: SwarmTask): void {
        const duration = (task.endTime || Date.now()) - (task.startTime || Date.now());
        const success = task.status === 'completed';
        
        for (const agentId of task.assignedAgents) {
            let metrics = this.agentPerformance.get(agentId);
            
            if (!metrics) {
                metrics = {
                    tasksCompleted: 0,
                    totalDuration: 0,
                    successRate: 0,
                    averageDuration: 0
                };
            }
            
            if (success) {
                metrics.tasksCompleted++;
            }
            
            metrics.totalDuration += duration;
            metrics.averageDuration = metrics.totalDuration / (metrics.tasksCompleted || 1);
            metrics.successRate = success ? 
                (metrics.successRate + 1) / (metrics.tasksCompleted || 1) :
                metrics.successRate * 0.9; // Slightly decrease on failure
            
            this.agentPerformance.set(agentId, metrics);
        }
    }

    private inferTaskType(description: string): SwarmTask['type'] {
        const desc = description.toLowerCase();
        
        if (desc.includes('generate') || desc.includes('create') || desc.includes('build')) {
            return 'generation';
        } else if (desc.includes('analyze') || desc.includes('research') || desc.includes('investigate')) {
            return 'analysis';
        } else if (desc.includes('optimize') || desc.includes('improve') || desc.includes('refactor')) {
            return 'optimization';
        } else if (desc.includes('validate') || desc.includes('test') || desc.includes('verify')) {
            return 'validation';
        }
        
        return 'generation'; // Default
    }

    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private setupTreeView(): void {
        const treeView = vscode.window.createTreeView('unjucksSwarm', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });

        this.context.subscriptions.push(treeView);
    }

    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand('unjucks.pauseSwarm', () => this.pauseSwarm()),
            vscode.commands.registerCommand('unjucks.resumeSwarm', () => this.resumeSwarm()),
            vscode.commands.registerCommand('unjucks.stopSwarm', () => this.stopSwarm()),
            vscode.commands.registerCommand('unjucks.showTaskDetails', (task: SwarmTask) => this.showTaskDetails(task)),
            vscode.commands.registerCommand('unjucks.cancelTask', (task: SwarmTask) => this.cancelTask(task))
        ];

        this.context.subscriptions.push(...commands);
    }

    private async showTaskDetails(task: SwarmTask): Promise<void> {
        const duration = task.endTime ? 
            ((task.endTime - (task.startTime || 0)) / 1000).toFixed(1) + 's' :
            task.startTime ? 
                ((Date.now() - task.startTime) / 1000).toFixed(1) + 's (running)' :
                'Not started';
        
        const details = [
            `**Task:** ${task.description}`,
            `**Type:** ${task.type}`,
            `**Status:** ${task.status}`,
            `**Progress:** ${task.progress}%`,
            `**Duration:** ${duration}`,
            `**Agents:** ${task.assignedAgents.length}`,
            '',
            '**Assigned Agents:**',
            ...task.assignedAgents.map(id => `• ${id}`)
        ];
        
        if (task.results) {
            details.push('', '**Results:**', JSON.stringify(task.results, null, 2));
        }
        
        const panel = vscode.window.createWebviewPanel(
            'taskDetails',
            `Task Details - ${task.id}`,
            vscode.ViewColumn.Beside,
            {}
        );
        
        panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    line-height: 1.6;
                }
                pre { 
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 10px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            ${details.map(line => line.startsWith('**') ? 
                `<p><strong>${line.replace(/\*\*/g, '')}</strong></p>` : 
                line.startsWith('•') ? 
                `<p style="margin-left: 20px;">${line}</p>` :
                line.startsWith('{') ? 
                `<pre>${line}</pre>` :
                `<p>${line}</p>`
            ).join('')}
        </body>
        </html>
        `;
    }

    private async cancelTask(task: SwarmTask): Promise<void> {
        if (task.status !== 'running' && task.status !== 'pending') {
            vscode.window.showInformationMessage('Task is not active');
            return;
        }
        
        const action = await vscode.window.showWarningMessage(
            `Cancel task: ${task.description.substring(0, 50)}...?`,
            'Cancel Task',
            'Keep Running'
        );
        
        if (action === 'Cancel Task') {
            task.status = 'failed';
            task.endTime = Date.now();
            this.treeProvider.refresh();
            
            vscode.window.showInformationMessage('Task cancelled');
        }
    }

    private updateStatusBar(text: string, status: 'active' | 'paused' | 'stopped'): void {
        const icons = {
            active: '$(organization)',
            paused: '$(debug-pause)',
            stopped: '$(debug-stop)'
        };

        this.statusBarItem.text = `${icons[status]} ${text}`;
        this.statusBarItem.command = 'unjucks.showSwarmStatus';
        this.statusBarItem.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
        this.swarmTasks.clear();
        this.agentPerformance.clear();
    }
}

interface AgentPerformanceMetrics {
    tasksCompleted: number;
    totalDuration: number;
    averageDuration: number;
    successRate: number;
}

class SwarmTreeProvider implements vscode.TreeDataProvider<SwarmTask> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SwarmTask | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private swarmCoordinator: SwarmCoordinator) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SwarmTask): vscode.TreeItem {
        const item = new vscode.TreeItem(
            element.description.substring(0, 50) + (element.description.length > 50 ? '...' : ''),
            vscode.TreeItemCollapsibleState.None
        );

        // Set icon based on status
        const statusIcons = {
            pending: '$(clock)',
            running: '$(sync~spin)',
            completed: '$(check)',
            failed: '$(error)'
        };

        item.iconPath = new vscode.ThemeIcon(statusIcons[element.status] || 'question');
        item.description = `${element.progress}% - ${element.status}`;
        item.tooltip = `Task: ${element.description}\nStatus: ${element.status}\nProgress: ${element.progress}%\nAgents: ${element.assignedAgents.length}`;
        item.contextValue = element.status;
        
        item.command = {
            command: 'unjucks.showTaskDetails',
            title: 'Show Details',
            arguments: [element]
        };

        return item;
    }

    async getChildren(element?: SwarmTask): Promise<SwarmTask[]> {
        if (!element) {
            // Root level - return all tasks
            const tasks = await this.swarmCoordinator.getActiveTasks();
            return tasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        }
        return [];
    }
}