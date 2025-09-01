const AWS = require('aws-sdk');
const path = require('path');

class AWSStorageService {
  constructor(bucketName = process.env.S3_BUCKET, key = 'todos.json') {
    this.bucketName = bucketName;
    this.key = key;
    
    // Configure AWS SDK
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
      // AWS SDK will automatically use IAM roles in ECS
    });
    
    console.log(`AWSStorageService initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Initialize storage by creating the initial file if it doesn't exist
   */
  async initializeStorage() {
    try {
      // Check if the todos file exists
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: this.key
      }).promise();
      
      console.log('Storage file already exists');
    } catch (error) {
      if (error.code === 'NotFound') {
        // File doesn't exist, create it with empty array
        console.log('Creating initial storage file');
        await this.saveTodos([]);
      } else {
        throw new Error(`Failed to initialize storage: ${error.message}`);
      }
    }
  }

  /**
   * Load todos from S3
   * @returns {Promise<Array>} Array of todo objects
   */
  async loadTodos() {
    try {
      console.log(`Loading todos from S3: ${this.bucketName}/${this.key}`);
      
      const result = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: this.key
      }).promise();
      
      const todos = JSON.parse(result.Body.toString());
      console.log(`Loaded ${todos.length} todos from S3`);
      return todos;
      
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        console.log('No todos file found, initializing with empty array');
        await this.initializeStorage();
        return [];
      }
      
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format in S3 storage file');
      }
      
      console.error('Error loading todos from S3:', error);
      throw new Error(`Failed to load todos: ${error.message}`);
    }
  }

  /**
   * Save todos to S3
   * @param {Array} todos - Array of todo objects to save
   */
  async saveTodos(todos) {
    if (!Array.isArray(todos)) {
      throw new Error('Todos must be an array');
    }

    try {
      console.log(`Saving ${todos.length} todos to S3: ${this.bucketName}/${this.key}`);
      
      await this.s3.putObject({
        Bucket: this.bucketName,
        Key: this.key,
        Body: JSON.stringify(todos, null, 2),
        ContentType: 'application/json',
        // Add metadata for tracking
        Metadata: {
          'last-updated': new Date().toISOString(),
          'todo-count': todos.length.toString()
        }
      }).promise();
      
      console.log('Todos saved successfully to S3');
      
    } catch (error) {
      console.error('Error saving todos to S3:', error);
      throw new Error(`Failed to save todos: ${error.message}`);
    }
  }

  /**
   * Check if storage is accessible
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: this.key
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage information
   * @returns {Object}
   */
  getStorageInfo() {
    return {
      type: 'AWS S3',
      bucket: this.bucketName,
      key: this.key,
      region: process.env.AWS_REGION || 'us-east-1'
    };
  }

  /**
   * Create a backup of current todos
   * @returns {Promise<string>} Backup key
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `backups/todos-backup-${timestamp}.json`;
      
      // Get current todos
      const todos = await this.loadTodos();
      
      // Save backup
      await this.s3.putObject({
        Bucket: this.bucketName,
        Key: backupKey,
        Body: JSON.stringify(todos, null, 2),
        ContentType: 'application/json',
        Metadata: {
          'backup-date': new Date().toISOString(),
          'original-key': this.key,
          'todo-count': todos.length.toString()
        }
      }).promise();
      
      console.log(`Backup created: ${backupKey}`);
      return backupKey;
      
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * List available backups
   * @returns {Promise<Array>} Array of backup information
   */
  async listBackups() {
    try {
      const result = await this.s3.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: 'backups/',
        MaxKeys: 50
      }).promise();
      
      return result.Contents.map(obj => ({
        key: obj.Key,
        lastModified: obj.LastModified,
        size: obj.Size
      }));
      
    } catch (error) {
      console.error('Error listing backups:', error);
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Health check for storage service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Test bucket access
      await this.s3.headBucket({
        Bucket: this.bucketName
      }).promise();
      
      // Test file access
      const fileExists = await this.exists();
      
      return {
        status: 'healthy',
        bucket: this.bucketName,
        fileExists,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        bucket: this.bucketName,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = AWSStorageService;