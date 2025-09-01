const fs = require('fs').promises;
const path = require('path');

class StorageService {
  constructor(filePath = 'data/todos.json') {
    this.filePath = filePath;
    this.dataDir = path.dirname(filePath);
  }

  /**
   * Initialize storage by creating data directory and file if they don't exist
   */
  async initializeStorage() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Check if file exists, if not create it with empty array
      try {
        await fs.access(this.filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          await this.saveTodos([]);
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`);
    }
  }

  /**
   * Load todos from JSON file
   * @returns {Promise<Array>} Array of todo objects
   */
  async loadTodos() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, initialize and return empty array
        await this.initializeStorage();
        return [];
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format in storage file');
      }
      throw new Error(`Failed to load todos: ${error.message}`);
    }
  }

  /**
   * Save todos to JSON file using atomic write operation
   * @param {Array} todos - Array of todo objects to save
   */
  async saveTodos(todos) {
    if (!Array.isArray(todos)) {
      throw new Error('Todos must be an array');
    }

    // Ensure directory exists before writing
    await fs.mkdir(this.dataDir, { recursive: true });

    const tempFilePath = `${this.filePath}.tmp`;
    
    try {
      // Write to temporary file first (atomic operation)
      await fs.writeFile(tempFilePath, JSON.stringify(todos, null, 2), 'utf8');
      
      // Rename temporary file to actual file (atomic on most filesystems)
      await fs.rename(tempFilePath, this.filePath);
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to save todos: ${error.message}`);
    }
  }

  /**
   * Check if storage file exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage file path
   * @returns {string}
   */
  getFilePath() {
    return this.filePath;
  }
}

module.exports = StorageService;