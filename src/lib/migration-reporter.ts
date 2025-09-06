/**
 * Reports migration results and progress
 */
export class MigrationReporter {
  /**
   * Reports migration results
   * @param results Migration results to report
   */
  report(results: any): void {
    if (!results) {
      console.log('Migration completed with no results');
      return;
    }

    console.log('Migration Results:');
    console.log('================');
    
    if (results.success) {
      console.log(`✅ Migration successful`);
    } else {
      console.log(`❌ Migration failed`);
    }

    if (results.filesProcessed) {
      console.log(`📁 Files processed: ${results.filesProcessed}`);
    }

    if (results.errors && results.errors.length > 0) {
      console.log(`🚨 Errors encountered: ${results.errors.length}`);
      results.errors.forEach((error: string, index: number) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (results.warnings && results.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${results.warnings.length}`);
      results.warnings.forEach((warning: string, index: number) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    if (results.duration) {
      console.log(`⏱️  Duration: ${results.duration}ms`);
    }
  }

  /**
   * Reports migration progress
   * @param current Current step
   * @param total Total steps
   * @param message Progress message
   */
  reportProgress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    console.log(`[${current}/${total}] (${percentage}%) ${message}`);
  }

  /**
   * Reports migration error
   * @param error Error to report
   */
  reportError(error: Error | string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    console.error(`❌ Migration Error: ${errorMessage}`);
  }

  /**
   * Reports migration warning
   * @param warning Warning to report
   */
  reportWarning(warning: string): void {
    console.warn(`⚠️  Migration Warning: ${warning}`);
  }

  /**
   * Generates a migration report and saves it to a file
   * @param results Migration results
   * @param reportPath Path to save the report to
   * @returns Promise resolving when report is saved
   */
  async generateReport(results: any, reportPath: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      success: results?.conversionResults?.errors?.length === 0,
      sourcePath: results?.sourcePath,
      targetPath: results?.targetPath,
      filesProcessed: results?.scanResult?.templates?.length || 0,
      errors: results?.conversionResults?.errors || [],
      warnings: results?.conversionResults?.warnings || [],
      validationResults: results?.validationResults,
      duration: results?.duration,
      options: results?.options
    };

    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  }
}