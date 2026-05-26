import crypto from 'crypto';

class Encipherment {
  constructor() {
    this.algorithm = 'aes192';
    this.password = 'f18JnJpmd';
  }

  encrypt(text) {
    const cipher = crypto.createCipher(this.algorithm, this.password);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
  }

  decrypt(text) {
    const decipher = crypto.createCipheriv(this.algorithm, this.password);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const encipherment = new Encipherment();


