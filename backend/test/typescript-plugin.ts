import ts from 'typescript';

// Nest's dependency injection and ValidationPipe require decorator metadata.
// Vite's default TypeScript transform does not emit that metadata.
export function typescriptPlugin() {
  return {
    name: 'typescript-decorator-metadata',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return;
      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2023,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          sourceMap: true,
        },
      });
      return { code: result.outputText, map: result.sourceMapText };
    },
  };
}
