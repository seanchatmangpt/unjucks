import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

export interface MCPAgent {
    id: string;
    type: string;
    status: 'active' | 'idle' | 'busy' | 'error';
    capabilities: string[];
    lastActivity: number;
}

export interface SwarmStatus {
    id: string;
    topology: string;
    agents: MCPAgent[];
    status: 'initializing' | 'active' | 'idle' | 'terminating';
    performance: {
        completedTasks: number;
        averageTime: number;
        successRate: number;
    };
}

export class MCPIntegration implements vscode.Disposable {
    private mcpProcess: ChildProcess | undefined;
    private swarmStatus: SwarmStatus | undefined;
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;
    private isInitialized = false;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Unjucks MCP');
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99
        );
        this.statusBarItem.command = 'unjucks.showMCPStatus';
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            this.outputChannel.appendLine('Initializing MCP integration...');
            
            // Check if claude-flow is available
            const isAvailable = await this.checkClaudeFlowAvailability();
            if (!isAvailable) {
                throw new Error('Claude Flow MCP server not found. Please install with: npm install -g claude-flow@alpha');
            }

            // Initialize swarm with mesh topology for VS Code integration
            await this.initializeSwarm();
            
            this.isInitialized = true;
            this.updateStatusBar('MCP Ready', 'ready');
            
            vscode.window.showInformationMessage('MCP integration initialized successfully');
            
        } catch (error) {
            this.outputChannel.appendLine(`MCP initialization failed: ${error}`);
            this.updateStatusBar('MCP Error', 'error');
            
            const action = await vscode.window.showErrorMessage(
                `MCP initialization failed: ${error}`,
                'Retry',
                'Disable MCP'
            );
            
            if (action === 'Retry') {
                setTimeout(() => this.initialize(), 5000);
            } else if (action === 'Disable MCP') {
                await vscode.workspace.getConfiguration('unjucks').update('mcpEnabled', false);
            }
        }
    }

    async initializeSwarm(): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const result = await this.executeCommand('swarm_init', {
                topology: 'mesh',
                maxAgents: vscode.workspace.getConfiguration('unjucks').get<number>('swarmMaxAgents') || 5,
                strategy: 'adaptive'
            });

            if (result.success) {
                this.swarmStatus = {
                    id: result.swarmId,
                    topology: 'mesh',
                    agents: [],
                    status: 'active',
                    performance: {
                        completedTasks: 0,
                        averageTime: 0,
                        successRate: 1.0
                    }
                };

                await vscode.commands.executeCommand('setContext', 'unjucks:swarmActive', true);
                this.outputChannel.appendLine(`Swarm initialized: ${result.swarmId}`);
                
                return result.swarmId;
            } else {
                throw new Error(result.error || 'Failed to initialize swarm');
            }
        } catch (error) {
            this.outputChannel.appendLine(`Swarm initialization failed: ${error}`);
            throw error;
        }
    }

    async spawnAgent(type: string, capabilities?: string[]): Promise<MCPAgent> {
        if (!this.swarmStatus) {
            throw new Error('Swarm not initialized');
        }

        const result = await this.executeCommand('agent_spawn', {
            type,
            capabilities: capabilities || this.getDefaultCapabilities(type)
        });

        if (result.success) {
            const agent: MCPAgent = {
                id: result.agentId,
                type,
                status: 'active',
                capabilities: capabilities || this.getDefaultCapabilities(type),
                lastActivity: Date.now()
            };

            this.swarmStatus.agents.push(agent);
            this.updateStatusBar(`${this.swarmStatus.agents.length} agents`, 'active');
            
            return agent;
        } else {
            throw new Error(result.error || 'Failed to spawn agent');
        }
    }

    async orchestrateTask(
        task: string, 
        options: {
            priority?: 'low' | 'medium' | 'high' | 'critical';
            strategy?: 'parallel' | 'sequential' | 'adaptive';
            maxAgents?: number;
        } = {}
    ): Promise<string> {
        if (!this.swarmStatus) {
            throw new Error('Swarm not initialized');
        }

        const result = await this.executeCommand('task_orchestrate', {
            task,
            priority: options.priority || 'medium',
            strategy: options.strategy || 'adaptive',
            maxAgents: options.maxAgents
        });

        if (result.success) {
            this.outputChannel.appendLine(`Task orchestrated: ${result.taskId}`);
            return result.taskId;
        } else {
            throw new Error(result.error || 'Failed to orchestrate task');
        }
    }

    async getSwarmStatus(): Promise<SwarmStatus | undefined> {
        if (!this.swarmStatus) {
            return undefined;
        }

        try {
            const result = await this.executeCommand('swarm_status', {
                swarmId: this.swarmStatus.id
            });

            if (result.success) {
                // Update local status with server data
                this.swarmStatus.agents = result.agents.map((agent: any) => ({
                    id: agent.id,
                    type: agent.type,
                    status: agent.status,
                    capabilities: agent.capabilities,
                    lastActivity: agent.lastActivity
                }));

                this.swarmStatus.performance = result.performance;
            }

            return this.swarmStatus;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to get swarm status: ${error}`);
            return this.swarmStatus;
        }
    }

    async getTaskStatus(taskId: string): Promise<any> {
        const result = await this.executeCommand('task_status', { taskId });
        
        if (result.success) {
            return result.status;
        } else {
            throw new Error(result.error || 'Failed to get task status');
        }
    }

    async getTaskResults(taskId: string): Promise<any> {
        const result = await this.executeCommand('task_results', { taskId });
        
        if (result.success) {
            return result.results;
        } else {
            throw new Error(result.error || 'Failed to get task results');
        }
    }

    async trainNeuralPatterns(data: any): Promise<void> {
        await this.executeCommand('neural_train', {
            pattern_type: 'coordination',
            training_data: JSON.stringify(data),
            epochs: 10
        });
    }

    async storeMemory(key: string, value: any, namespace: string = 'unjucks'): Promise<void> {
        await this.executeCommand('memory_usage', {
            action: 'store',
            key,
            value: JSON.stringify(value),
            namespace,
            ttl: 3600 // 1 hour
        });
    }

    async retrieveMemory(key: string, namespace: string = 'unjucks'): Promise<any> {
        const result = await this.executeCommand('memory_usage', {
            action: 'retrieve',
            key,
            namespace
        });

        if (result.success && result.value) {
            try {
                return JSON.parse(result.value);
            } catch {
                return result.value;
            }
        }

        return null;
    }

    private async executeCommand(command: string, args: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const process = spawn('npx', ['claude-flow@alpha', 'mcp', command, ...this.argsToArray(args)], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch {
                        resolve({ success: true, output: stdout });
                    }
                } else {
                    reject(new Error(stderr || `Process exited with code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });

            // Set timeout
            setTimeout(() => {
                process.kill();
                reject(new Error('Command timeout'));
            }, 30000);
        });
    }

    private argsToArray(args: any): string[] {
        const result: string[] = [];
        
        for (const [key, value] of Object.entries(args)) {
            if (value !== undefined && value !== null) {
                result.push(`--${key}`);
                result.push(String(value));
            }
        }
        
        return result;
    }

    private async checkClaudeFlowAvailability(): Promise<boolean> {
        try {
            await this.executeCommand('--version');
            return true;
        } catch {
            return false;
        }
    }

    private getDefaultCapabilities(type: string): string[] {
        const capabilityMap: Record<string, string[]> = {
            'coder': ['code-generation', 'refactoring', 'debugging'],
            'researcher': ['analysis', 'documentation', 'requirements'],
            'tester': ['testing', 'validation', 'quality-assurance'],
            'reviewer': ['code-review', 'security-audit', 'performance-analysis'],
            'architect': ['system-design', 'architecture', 'patterns'],
            'coordinator': ['task-management', 'orchestration', 'coordination']
        };
        
        return capabilityMap[type] || ['general'];
    }

    private updateStatusBar(text: string, status: 'ready' | 'active' | 'error'): void {
        const icons = {
            ready: '$(check)',
            active: '$(sync~spin)',
            error: '$(error)'
        };

        this.statusBarItem.text = `${icons[status]} MCP: ${text}`;
        this.statusBarItem.show();
    }

    public showOutput(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        if (this.mcpProcess) {
            this.mcpProcess.kill();
        }
        
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }
}