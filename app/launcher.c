#include <stdint.h>
#include <stddef.h>

typedef uint16_t Wide;
typedef void *Handle;
typedef uint32_t Dword;
typedef int Bool;
typedef uintptr_t Result;
#define P(fn, sig, index) ((fn (*) sig) api[index])
#define GetEnvironmentVariableW P(Dword,(const Wide *,Wide *,Dword),0)
#define GetTempPathW P(Dword,(Dword,Wide *),1)
#define CreateDirectoryW P(Bool,(const Wide *,void *),2)
#define GetTempFileNameW P(unsigned,(const Wide *,const Wide *,unsigned,Wide *),3)
#define CreateFileW P(Handle,(const Wide *,Dword,Dword,void *,Dword,Dword,Handle),4)
#define WriteFile P(Bool,(Handle,const void *,Dword,Dword *,void *),5)
#define CloseHandle P(Bool,(Handle),6)
#define MoveFileExW P(Bool,(const Wide *,const Wide *,Dword),7)
#define DeleteFileW P(Bool,(const Wide *),8)
#define WideCharToMultiByte P(int,(unsigned,Dword,const Wide *,int,char *,int,const char *,Bool *),9)
#define ExitProcess P(void,(unsigned),10)
#define ShellExecuteW P(Result,(void *,const Wide *,const Wide *,const Wide *,const Wide *,int),12)
#define MessageBoxW P(int,(void *,const Wide *,const Wide *,unsigned),14)

extern const unsigned char web_start[], web_end[];
extern void *volatile api[256];
static Wide base[260], output[260], temp[260], args[3500];
static char utf8[1100];

static Wide *append(Wide *out, const Wide *in) {
    while (*in) *out++ = *in++;
    *out = 0;
    return out;
}

static void fail(const Wide *message) {
    MessageBoxW(0,message,L"D&D Spell Prep",0x10);
    ExitProcess(1);
}

static Bool writeApp(void) {
    if (!GetTempFileNameW(base,L"dnd",0,temp)) return 0;
    Handle file = CreateFileW(temp,0x40000000,0,0,2,0x80,0);
    if (file == (Handle)(intptr_t)-1) {
        DeleteFileW(temp);
        return 0;
    }
    Dword written = 0;
    Dword size = (Dword)(web_end-web_start);
    Bool ok = WriteFile(file,web_start,size,&written,0);
    CloseHandle(file);
    if (ok && written == size && MoveFileExW(temp,output,0x1|0x8)) return 1;
    DeleteFileW(temp);
    return 0;
}

static Bool appArgs(void) {
    if (!WideCharToMultiByte(65001,0,output,-1,utf8,sizeof(utf8),0,0)) return 0;
    Wide *dest = append(args,L"--app=\"file:///");
    const Wide *hex = L"0123456789ABCDEF";
    for (const unsigned char *p=(const unsigned char *)utf8; *p; ++p) {
        unsigned c = *p;
        if (c=='\\') *dest++ = '/';
        else if ((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||
                 c=='-'||c=='_'||c=='.'||c=='~'||c==':') *dest++ = (Wide)c;
        else {
            *dest++ = '%';
            *dest++ = hex[c >> 4];
            *dest++ = hex[c & 15];
        }
    }
    append(dest,L"\"");
    return 1;
}

void start(void) {
    Dword n = GetEnvironmentVariableW(L"LOCALAPPDATA",base,230);
    if (!n || n>=230) n=GetTempPathW(230,base);
    if (!n || n>=230) fail(L"Could not find the local app folder.\n無法取得本機應用程式資料夾。");
    if (base[n-1]!='\\') base[n++]='\\';
    append(base+n,L"DndSpellPrep");
    CreateDirectoryW(base,0);
    append(append(output,base),L"\\法術整備輔助.html");
    if (!writeApp()) fail(L"Could not write the offline app to the local folder.\n請檢查本機資料夾是否可供寫入。");
    if (appArgs() && ShellExecuteW(0,L"open",L"msedge.exe",args,0,1)>32) ExitProcess(0);
    if (ShellExecuteW(0,L"open",output,0,0,1)<=32)
        fail(L"Could not open the app. Check the default browser.\n請確認系統已設定預設瀏覽器。");
    ExitProcess(0);
}
