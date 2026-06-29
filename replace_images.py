#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
替换去重合集.json中的图片链接为s3.hi168 OSS链接
"""

import json
import re
import os

MAPPING_FILE = r"f:\Code\uniapp\试卷\newPapers\image_mapping.json"
TARGET_FILE = r"f:\Code\uniapp\demo\backend\admin-panel\public\去重合集.json"


def load_mapping():
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_urls(text):
    urls = set()
    md_pattern = re.compile(r'!\[.*?\]\((.*?)\)')
    urls.update(md_pattern.findall(text))
    html_pattern = re.compile(r'<img[^>]+src=["\'](.*?)["\']')
    urls.update(html_pattern.findall(text))
    return urls


def process_node(node, mapping, stats):
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(value, str):
                urls = extract_urls(value)
                for old_url in urls:
                    if old_url in mapping:
                        oss_url = mapping[old_url].get('oss')
                        if oss_url:
                            node[key] = node[key].replace(old_url, oss_url)
                            stats['replaced'] += 1
                            if old_url not in stats['replaced_urls']:
                                stats['replaced_urls'].append(old_url)
            else:
                process_node(value, mapping, stats)
    elif isinstance(node, list):
        for item in node:
            process_node(item, mapping, stats)


def main():
    print("=" * 60)
    print("替换去重合集.json中的图片链接")
    print("=" * 60)

    mapping = load_mapping()
    print(f"已加载 {len(mapping)} 条图片映射")

    with open(TARGET_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    stats = {'replaced': 0, 'replaced_urls': []}
    process_node(data, mapping, stats)

    with open(TARGET_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n替换完成!")
    print(f"  替换次数: {stats['replaced']}")
    print(f"  涉及URL: {len(stats['replaced_urls'])}")
    print("=" * 60)


if __name__ == "__main__":
    main()