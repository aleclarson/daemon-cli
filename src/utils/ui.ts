import * as p from '@clack/prompts';

export const log = p.log;
export const spinner = p.spinner();

export async function prompt(message: string, initialValue?: string): Promise<string> {
  const result = await p.text({
    message,
    initialValue,
    validate: (value) => {
      if (!value) return 'Value is required';
      return;
    }
  });
  if (p.isCancel(result)) {
    process.exit(0);
  }
  return result as string;
}

export async function confirm(message: string): Promise<boolean> {
  const result = await p.confirm({
    message
  });
  if (p.isCancel(result)) {
    process.exit(0);
  }
  return result as boolean;
}

export async function select<T>(message: string, options: { label: string; value: T }[]): Promise<T> {
  const result = await p.select({
    message,
    options: options as any
  });
  if (p.isCancel(result)) {
    process.exit(0);
  }
  return result as T;
}
