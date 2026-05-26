import AWS from 'aws-sdk';
import config from '../config/default.js';
import fs from 'fs';
import { logger } from './logger.js';

AWS.config.update({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
});

class S3 {
  #s3 = new AWS.S3();
  #defaultParams = {
    Bucket: config.aws.bucketName,
  }

  constructor() {}

  /**
   * Upload file to S3 bucket
   * @param {String} fileName file name or S3 object key
   * @param {fs.ReadStream} content file content
   * @returns {Promise} S3 response
   */
  upload(fileName, content) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!fileName || !content) {
          return reject('Invalid fileName/content');
        }
        const putParams = { ...this.#defaultParams, Key: fileName, Body: content };
        const response = await this.#s3.putObject(putParams).promise();
        if (response) {
          return resolve(response);
        }
        return reject('No response from AWS');
      } catch (error) {
        logger.error(error, 'ERROR_S3_UPLOAD_FILE');
        return reject(error);
      }
    })
  }

  /**
   * Fetch a file from S3 bucket
   * @param {String} fileName file name or S3 object key
   * @returns {Promise} S3 response
   */
  fetchFile(fileName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!fileName) {
          return reject('Invalid fileName');
        }
        const getParams = { ...this.#defaultParams, Key: fileName };
        const response = await this.#s3.getObject(getParams).promise();
        if (response && response.Body) {
          const [originalFileName] = fileName.split('/').slice(-1);
          const file = {
            name: originalFileName,
            data: response.Body.toString(),
          };
          return resolve(file);
        }
        return reject('No response from AWS');
      } catch (error) {
        logger.error(error, 'ERROR_S3_FETCH_FILE');
        return reject(error);
      }
    })
  }

  /**
   * Fetch contents inside folder from S3 bucket
   * @param {String} fileName file name or S3 object key
   * @returns {Promise} S3 response
   */
  async fetchFolder(folderPath) {
    try {
      if (!folderPath) {
        return Promise.reject('Invalid folderPath');
      }
      const getParams = { ...this.#defaultParams, Prefix: folderPath };
      const response = await this.#s3.listObjectsV2(getParams).promise();
      if (response) {
        return Promise.resolve(response);
      }
      return Promise.reject('No response from AWS');
    } catch (error) {
      logger.error(error, 'ERROR_S3_FETCH_FOLDER');
      return Promise.reject(error);
    }
  }

  /**
   * Fetch contents inside folder from S3 bucket
   * @param {String} fileName file name or S3 object key
   * @returns {Promise} S3 response
   */
  fetchFilesByFolder(folderPath) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!folderPath) {
          return reject('Invalid folderPath');
        }
        console.log(folderPath);
        const getParams = { ...this.#defaultParams, Prefix: folderPath };
        const response = await this.#s3.listObjectsV2(getParams).promise();
        if (response && response.Contents && response.Contents.length) {
          const filePaths = [...response.Contents];
          return resolve(filePaths.map(({ Key }) => { return this.fetchFile(Key); }));
        }
        console.log(response);
        return reject('No response from AWS');
      } catch (error) {
        logger.error(error, 'ERROR_S3_FETCH_FILES_BY_FOLDER');
        return reject(error);
      }
    })
  }

  async deleteFile(fileName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!fileName) {
          return reject('Invalid fileName');
        }
        const deleteParams = { ...this.#defaultParams, Key: fileName };
        const response = await this.#s3.deleteObject(deleteParams).promise();
        return resolve(response);
      } catch (error) {
        logger.error(error, 'ERROR_S3_DELETE_FILE');
        return reject(error);
      }
    });
  }

  deleteAttchmentFile(fileName, folderPath) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!fileName) {
          return reject('Invalid fileName');
        }
        const deleteParams = { ...this.#defaultParams, Key: `${folderPath}${fileName}` };
        const response = await this.#s3.deleteObject(deleteParams).promise();
        return resolve(response);
      } catch (error) {
        logger.error(error, 'ERROR_S3_DELETE_FILE');
        return reject(error);
      }
    })
  }
};

export default S3;
