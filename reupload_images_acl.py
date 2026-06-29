#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重新上传图片到OSS，设置public-read ACL
"""

import json
import os
import boto3
from botocore.config import Config
import warnings

warnings.filterwarnings("ignore", message="Boto3 will no longer support Python 3.9")

OSS_ACCESS_KEY = "F6IY1QRB154UPZTB9U86"
OSS_SECRET_KEY = "bZtqIRubTHshz9PLMBJemQZyfgsCL5iBprb6AkhB"
OSS_ENDPOINT = "https://s3.hi168.com"
OSS_BUCKET = "hi168-26998-7111ilq6"
OSS_REGION = "us-west-1"

MAPPING_FILE = r"f:\Code\uniapp\试卷\newPapers\image_mapping.json"


def get_content_type(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    content_type_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    }
    return content_type_map.get(ext, 'application/octet-stream')


def reupload_with_acl(local_path, oss_url):
    object_name = oss_url.split('/')[-1]
    if 'exercises/' in oss_url:
        object_name = f"exercises/{object_name}"
    
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=OSS_ACCESS_KEY,
            aws_secret_access_key=OSS_SECRET_KEY,
            endpoint_url=OSS_ENDPOINT,
            config=Config(
                signature_version='s3',
                retries={'max_attempts': 3, 'mode': 'standard'}
            ),
            region_name=OSS_REGION
        )
        
        content_type = get_content_type(local_path)
        s3_client.upload_file(
            local_path,
            OSS_BUCKET,
            object_name,
            ExtraArgs={
                'ContentType': content_type,
                'ACL': 'public-read'
            }
        )
        return True
    except Exception as e:
        print(f"  [失败] {local_path}: {e}")
        return False


def main():
    print("=" * 60)
    print("重新上传图片，设置public-read ACL")
    print("=" * 60)
    
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    
    print(f"共 {len(mapping)} 条映射")
    
    success = 0
    failed = 0
    skipped = 0
    
    for old_url, data in mapping.items():
        local_path = data.get('local')
        oss_url = data.get('oss')
        
        if not local_path or not oss_url:
            skipped += 1
            continue
        
        if not os.path.exists(local_path):
            print(f"  [跳过] 本地文件不存在: {local_path}")
            skipped += 1
            continue
        
        if reupload_with_acl(local_path, oss_url):
            success += 1
            print(f"  [OK] {oss_url}")
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print("重新上传完成!")
    print(f"  成功: {success}")
    print(f"  失败: {failed}")
    print(f"  跳过: {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    main()