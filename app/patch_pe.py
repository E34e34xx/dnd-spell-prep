from pathlib import Path
import re
import struct
import subprocess
import sys

path = Path(sys.argv[1])
image = bytearray(path.read_bytes())
symbol_table = subprocess.check_output(["nm", str(path)], text=True)
iat_va = int(re.search(r"^([0-9a-f]+) D api$", symbol_table, re.M).group(1), 16)

def get(fmt, off):
    return struct.unpack_from("<"+fmt, image, off)

def put(off, fmt, *values):
    struct.pack_into("<"+fmt, image, off, *values)

nt, = get("I", 0x3c)
sections, = get("H", nt+6)
opt_size, = get("H", nt+20)
opt = nt+24
base, = get("Q", opt+24)
iat_rva = iat_va-base
table = opt+opt_size

def map_rva(rva):
    for i in range(sections):
        _, addr, length, start = get("IIII", table+i*40+8)
        if addr <= rva < addr+length:
            return start+rva-addr
    raise ValueError("Unmapped RVA")

iat = map_rva(iat_rva)
dirs = opt+112
dlls = {
    "KERNEL32.dll": [
        "GetEnvironmentVariableW", "GetTempPathW", "CreateDirectoryW", "GetTempFileNameW",
        "CreateFileW", "WriteFile", "CloseHandle", "MoveFileExW", "DeleteFileW",
        "WideCharToMultiByte", "ExitProcess"
    ],
    "SHELL32.dll": ["ShellExecuteW"],
    "USER32.dll": ["MessageBoxW"],
}
size = sum(len(names)+1 for names in dlls.values())*8
ilt = iat+size
desc = ilt+size
data = desc+20*(len(dlls)+1)
cursor = 0
rva = lambda offset: iat_rva + offset - iat

def cstring(value, hint=False):
    global data
    value = (b"\0\0" if hint else b"")+value.encode("ascii")+b"\0"
    offset = data
    image[offset:offset+len(value)] = value
    data += (len(value)+1)&~1
    return rva(offset)

for i, (dll, names) in enumerate(dlls.items()):
    put(desc+20*i,"IIIII",rva(ilt+cursor),0,0,cstring(dll),rva(iat+cursor))
    for name in names:
        at = cstring(name, hint=True)
        put(iat+cursor,"Q",at)
        put(ilt+cursor,"Q",at)
        cursor += 8
    cursor += 8

assert data <= iat+2048
assert cursor == size
put(dirs+1*8,"II",rva(desc),(len(dlls)+1)*20)
put(dirs+12*8,"II",iat_rva,size)
path.write_bytes(image)
