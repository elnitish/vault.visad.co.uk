<?php
/**
 * File Management Utilities
 * Helper functions for managing files organized by year/month
 */

require_once('config.php');

/**
 * Get storage statistics by month
 */
function getStorageStats() {
    $uploadBaseDir = __DIR__ . '/../uploads/documents/';
    $categories = ['insurance', 'flight', 'application', 'appointment', 'hotel'];
    
    $stats = [];
    
    foreach ($categories as $category) {
        $categoryPath = $uploadBaseDir . $category . '/';
        
        if (!is_dir($categoryPath)) continue;
        
        // Get all year directories
        $years = glob($categoryPath . '*', GLOB_ONLYDIR);
        
        foreach ($years as $yearPath) {
            $year = basename($yearPath);
            
            // Get all month directories
            $months = glob($yearPath . '/*', GLOB_ONLYDIR);
            
            foreach ($months as $monthPath) {
                $month = basename($monthPath);
                $files = glob($monthPath . '/*.*');
                $fileCount = count($files);
                $totalSize = 0;
                
                foreach ($files as $file) {
                    $totalSize += filesize($file);
                }
                
                $stats[] = [
                    'category' => $category,
                    'year' => $year,
                    'month' => $month,
                    'file_count' => $fileCount,
                    'total_size' => $totalSize,
                    'total_size_mb' => round($totalSize / 1024 / 1024, 2)
                ];
            }
        }
    }
    
    return $stats;
}

/**
 * Clean up files older than specified months
 * 
 * @param int $monthsOld Number of months (e.g., 12 for 1 year old)
 * @param bool $dryRun If true, only shows what would be deleted
 * @return array Results of cleanup
 */
function cleanupOldFiles($monthsOld = 12, $dryRun = true) {
    $uploadBaseDir = __DIR__ . '/../uploads/documents/';
    $categories = ['insurance', 'flight', 'application', 'appointment', 'hotel'];
    
    $cutoffDate = new DateTime();
    $cutoffDate->modify("-{$monthsOld} months");
    
    $results = [
        'deleted_folders' => [],
        'deleted_files' => 0,
        'freed_space' => 0,
        'dry_run' => $dryRun
    ];
    
    foreach ($categories as $category) {
        $categoryPath = $uploadBaseDir . $category . '/';
        
        if (!is_dir($categoryPath)) continue;
        
        $years = glob($categoryPath . '*', GLOB_ONLYDIR);
        
        foreach ($years as $yearPath) {
            $year = basename($yearPath);
            $months = glob($yearPath . '/*', GLOB_ONLYDIR);
            
            foreach ($months as $monthPath) {
                $month = basename($monthPath);
                
                // Create date from year/month
                $folderDate = DateTime::createFromFormat('Y-m', $year . '-' . $month);
                
                if ($folderDate < $cutoffDate) {
                    $files = glob($monthPath . '/*.*');
                    $folderSize = 0;
                    
                    foreach ($files as $file) {
                        $folderSize += filesize($file);
                    }
                    
                    $results['deleted_folders'][] = [
                        'path' => str_replace($uploadBaseDir, '', $monthPath),
                        'files' => count($files),
                        'size_mb' => round($folderSize / 1024 / 1024, 2)
                    ];
                    
                    $results['deleted_files'] += count($files);
                    $results['freed_space'] += $folderSize;
                    
                    // Actually delete if not dry run
                    if (!$dryRun) {
                        foreach ($files as $file) {
                            unlink($file);
                        }
                        rmdir($monthPath);
                    }
                }
            }
            
            // Remove empty year folders
            if (!$dryRun && is_dir($yearPath) && count(glob($yearPath . '/*')) === 0) {
                rmdir($yearPath);
            }
        }
    }
    
    $results['freed_space_mb'] = round($results['freed_space'] / 1024 / 1024, 2);
    
    return $results;
}

/**
 * Get file count by category and date range
 */
function getFileCountByDateRange($category, $startDate, $endDate) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total,
                SUM(file_size) as total_size
            FROM documents
            WHERE category = ?
            AND uploaded_at BETWEEN ? AND ?
            AND deleted_at IS NULL
        ");
        
        $stmt->execute([$category, $startDate, $endDate]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
        
    } catch(PDOException $e) {
        return ['total' => 0, 'total_size' => 0];
    }
}

/**
 * List files in a specific month
 */
function listFilesByMonth($category, $year, $month) {
    $uploadBaseDir = __DIR__ . '/../uploads/documents/';
    $monthPath = $uploadBaseDir . $category . '/' . $year . '/' . $month . '/';
    
    if (!is_dir($monthPath)) {
        return [];
    }
    
    $files = glob($monthPath . '/*.*');
    $fileList = [];
    
    foreach ($files as $file) {
        $fileList[] = [
            'name' => basename($file),
            'size' => filesize($file),
            'size_mb' => round(filesize($file) / 1024 / 1024, 2),
            'modified' => date('Y-m-d H:i:s', filemtime($file)),
            'path' => str_replace($uploadBaseDir, '', $file)
        ];
    }
    
    return $fileList;
}

/**
 * Archive old files to zip by month
 */
function archiveMonthToZip($category, $year, $month, $outputDir = null) {
    $uploadBaseDir = __DIR__ . '/../uploads/documents/';
    $monthPath = $uploadBaseDir . $category . '/' . $year . '/' . $month . '/';
    
    if (!is_dir($monthPath)) {
        return ['status' => 'error', 'message' => 'Month folder not found'];
    }
    
    $outputDir = $outputDir ?: __DIR__ . '/../archives/';
    if (!is_dir($outputDir)) {
        mkdir($outputDir, 0755, true);
    }
    
    $zipFileName = $outputDir . $category . '_' . $year . '_' . $month . '.zip';
    $zip = new ZipArchive();
    
    if ($zip->open($zipFileName, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        return ['status' => 'error', 'message' => 'Failed to create zip file'];
    }
    
    $files = glob($monthPath . '/*.*');
    $fileCount = 0;
    
    foreach ($files as $file) {
        $zip->addFile($file, basename($file));
        $fileCount++;
    }
    
    $zip->close();
    
    return [
        'status' => 'success',
        'zip_file' => $zipFileName,
        'files_archived' => $fileCount,
        'zip_size_mb' => round(filesize($zipFileName) / 1024 / 1024, 2)
    ];
}

// CLI usage
if (php_sapi_name() === 'cli') {
    echo "=== File Management Utilities ===\n\n";
    
    // Show storage stats
    echo "Storage Statistics:\n";
    echo str_repeat('-', 80) . "\n";
    printf("%-15s %-8s %-8s %-12s %-15s\n", "Category", "Year", "Month", "Files", "Size (MB)");
    echo str_repeat('-', 80) . "\n";
    
    $stats = getStorageStats();
    $totalFiles = 0;
    $totalSize = 0;
    
    foreach ($stats as $stat) {
        printf("%-15s %-8s %-8s %-12d %-15.2f\n", 
            $stat['category'], 
            $stat['year'], 
            $stat['month'], 
            $stat['file_count'],
            $stat['total_size_mb']
        );
        $totalFiles += $stat['file_count'];
        $totalSize += $stat['total_size_mb'];
    }
    
    echo str_repeat('-', 80) . "\n";
    printf("%-32s %-12d %-15.2f\n", "TOTAL", $totalFiles, $totalSize);
    echo "\n";
    
    // Show cleanup preview
    echo "Cleanup Preview (files older than 12 months):\n";
    echo str_repeat('-', 80) . "\n";
    
    $cleanup = cleanupOldFiles(12, true);
    
    if (count($cleanup['deleted_folders']) > 0) {
        foreach ($cleanup['deleted_folders'] as $folder) {
            printf("Would delete: %-40s (%d files, %.2f MB)\n", 
                $folder['path'], 
                $folder['files'], 
                $folder['size_mb']
            );
        }
        echo str_repeat('-', 80) . "\n";
        printf("Total: %d files, %.2f MB would be freed\n", 
            $cleanup['deleted_files'], 
            $cleanup['freed_space_mb']
        );
    } else {
        echo "No old files to clean up.\n";
    }
    
    echo "\n";
    echo "To actually perform cleanup, modify the script and set dryRun to false.\n";
}

?>
