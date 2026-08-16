import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

interface CloudinaryDeleteResult {
  result?: unknown;
}

function isCloudinaryDeleteResult(
  value: unknown,
): value is CloudinaryDeleteResult {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      const rawResult: unknown = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        type: 'upload',
        invalidate: true,
      });

      if (!isCloudinaryDeleteResult(rawResult)) {
        throw new Error('Invalid response received from Cloudinary');
      }

      console.log('Cloudinary delete result:', rawResult);

      if (rawResult.result !== 'ok' && rawResult.result !== 'not found') {
        throw new Error(
          `Cloudinary failed to delete "${publicId}": ${
            typeof rawResult.result === 'string'
              ? rawResult.result
              : 'unknown result'
          }`,
        );
      }
    } catch (error: unknown) {
      console.error('Cloudinary delete error:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Cloudinary delete failed: ${JSON.stringify(error)}`);
    }
  }
}
