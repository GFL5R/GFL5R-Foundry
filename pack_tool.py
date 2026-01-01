#!/usr/bin/env python3
import argparse
import json
import os
import random
import string
import time
import plyvel


def generate_uid(length=16):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def export_pack(pack_path: str, json_path: str):
    db = plyvel.DB(pack_path)
    data = {}
    for key, value in db:
        item = json.loads(value.decode('utf-8'))
        name = item.get('name', key.decode('utf-8'))
        clean = {
            'type': item.get('type'),
            'system': item.get('system'),
            'folder': item.get('folder'),
        }
        data[name] = clean
    db.close()
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def import_pack(pack_path: str, json_path: str):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if os.path.exists(pack_path):
        import shutil
        shutil.rmtree(pack_path)
    db = plyvel.DB(pack_path, create_if_missing=True)
    now = int(time.time() * 1000)
    with db.write_batch() as wb:
        for name, item in data.items():
            uid = generate_uid()
            full_item = {
                'name': name,
                'type': item.get('type'),
                '_id': uid,
                'img': 'icons/svg/item-bag.svg',
                'system': item.get('system'),
                'effects': [],
                'folder': item.get('folder', None),
                'sort': 0,
                'ownership': {'default': 0},
                'flags': {},
                '_stats': {
                    'compendiumSource': None,
                    'duplicateSource': None,
                    'exportSource': None,
                    'coreVersion': '13.351',
                    'systemId': 'gfl5r',
                    'systemVersion': '0.6.3',
                    'createdTime': now,
                    'modifiedTime': now,
                    'lastModifiedBy': None,
                },
            }
            key = f'!items!{uid}'
            wb.put(key.encode('utf-8'), json.dumps(full_item, ensure_ascii=False).encode('utf-8'))
    db.close()


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--import', dest='do_import', action='store_true')
    group.add_argument('--export', dest='do_export', action='store_true')
    parser.add_argument('--json', required=True)
    parser.add_argument('--pack', required=True)
    args = parser.parse_args()

    pack_path = os.path.join('packs', args.pack)

    if args.do_export:
        export_pack(pack_path, args.json)
    else:
        import_pack(pack_path, args.json)


if __name__ == '__main__':
    main()