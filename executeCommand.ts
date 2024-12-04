import { spawn, exec } from 'child_process';
import { promisify, inspect } from 'util';

const execPromise = promisify(exec);

// A utility function to execute a command
export async function executeCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await execPromise(command, {encoding: 'utf8'});
        if (stderr) {
            throw new Error(`Stderr: ${stderr}`);
        }
        return stdout;
    } catch (err: unknown) {
        console.log(inspect(err));
        if (err instanceof Error) {
            // Handle standard Error
            throw new Error(`Error: ${err.message}`);
        } else {
            // Handle non-Error types
            throw new Error(`Error: ${JSON.stringify(err)}`);
        }
    }
}

// Utility function to execute a command using spawn
export async function executeCommandNew(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, { shell: true });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr} ${stdout}`));
            }
        });

        process.on('error', (error) => {
            reject(error);
        });
    });
}