#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 app/build_web.py
gcc -std=c11 -Wall -Wextra -Werror -O2 -mabi=ms -fshort-wchar -ffreestanding -fno-builtin -fno-stack-protector -fno-asynchronous-unwind-tables -fno-unwind-tables -fpie -mno-red-zone -mdirect-extern-access -fno-ident -c app/launcher.c -o app/launcher.o
as -o app/resources.o app/resources.s
ld -mi386pep --subsystem windows --major-os-version 6 --minor-os-version 1 --major-subsystem-version 6 --minor-subsystem-version 1 --dynamicbase --nxcompat -e start app/launcher.o app/resources.o -o app/launcher.exe
python3 app/patch_pe.py app/launcher.exe
strip --strip-all app/launcher.exe
