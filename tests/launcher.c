#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <uchar.h>

#define WINDOWS __attribute__((ms_abi))
typedef char16_t W;
static const W root[]=u"C:\\Users\\使用者 A\\AppData\\Local";
static const W folder[]=u"C:\\Users\\使用者 A\\AppData\\Local\\DndSpellPrep";
static const W filename[]=u"C:\\Users\\使用者 A\\AppData\\Local\\DndSpellPrep\\法術整備輔助.html";
static const W tmp[]=u"C:\\Users\\使用者 A\\AppData\\Local\\DndSpellPrep\\dndCF.tmp";
static const W command[]=u"--app=\"file:///C:/Users/%E4%BD%BF%E7%94%A8%E8%80%85%20A/AppData/Local/DndSpellPrep/%E6%B3%95%E8%A1%93%E6%95%B4%E5%82%99%E8%BC%94%E5%8A%A9.html\"";
static int fallback, launches;
static unsigned char *page;
static size_t page_length;

static int same(const W *a,const W *b) {
    while (*a && *a==*b) {a++;b++;}
    return *a==*b;
}
static unsigned copy(W *a,const W *b) {
    unsigned n=0;
    while ((a[n]=b[n])) ++n;
    return n;
}
static unsigned WINDOWS env(const W *want,W *out,unsigned limit) {assert(same(want,u"LOCALAPPDATA")&&limit>=100);return copy(out,root);}
static unsigned WINDOWS temp(unsigned n,W *out) {abort();}
static int WINDOWS mkdir_(const W *path,void *sec) {assert(same(path,folder)&&sec==0);return 1;}
static unsigned WINDOWS tempname(const W *path,const W *prefix,unsigned n,W *out) {assert(same(path,folder)&&same(prefix,u"dnd")&&!n);return copy(out,tmp);}
static void * WINDOWS create(const W *path,unsigned access,unsigned sharing,void *sec,unsigned disposition,unsigned attrib,void *template) {
    assert(same(path,tmp)&&access==0x40000000&&!sharing&&!sec&&disposition==2&&attrib==0x80&&!template);
    return (void *)43;
}
static int WINDOWS write_(void *handle,const void *buf,unsigned size,unsigned *done,void *ov) {
    assert(handle==(void *)43&&!ov&&size==page_length&&!memcmp(buf,page,size));
    *done=size;
    return 1;
}
static int WINDOWS close_(void *handle) {assert(handle==(void *)43);return 1;}
static int WINDOWS move_(const W *src,const W *dst,unsigned flags) {assert(same(src,tmp)&&same(dst,filename)&&flags==9);return 1;}
static int WINDOWS delete_(const W *path) {abort();}
static int WINDOWS convert(unsigned cp,unsigned flags,const W *str,int count,char *buf,int cap,const char *def,void *used) {
    assert(cp==65001&&!flags&&same(str,filename)&&count==-1&&cap>300&&!def&&!used);
    int n=0;
    for (;*str;str++) {
        unsigned c=*str;
        if(c<128) buf[n++]=c;
        else {buf[n++]=0xe0|(c>>12);buf[n++]=0x80|((c>>6)&63);buf[n++]=0x80|(c&63);}
    }
    buf[n]=0;
    return n+1;
}
static void WINDOWS exit_(unsigned code) {assert(!code&&launches==1+fallback);puts(fallback?"Passed Windows launcher browser fallback":"Passed Windows launcher Edge app path and exact embedded payload");exit(0);}
static uintptr_t WINDOWS launch(void *win,const W *verb,const W *path,const W *params,const W *dir,int show) {
    assert(!win&&!dir&&show==1&&same(verb,u"open"));
    if (!launches++) {assert(same(path,u"msedge.exe")&&same(params,command));return fallback?2:42;}
    assert(fallback&&same(path,filename)&&!params);
    return 42;
}
static int WINDOWS message(void *win,const W *msg,const W *title,unsigned flags) {abort();}
static unsigned char *read_file(const char *name,size_t *size) {
    FILE *f=fopen(name,"rb");assert(f);
    fseek(f,0,SEEK_END);*size=ftell(f);rewind(f);
    unsigned char *p=malloc(*size);assert(fread(p,1,*size,f)==*size);fclose(f);
    return p;
}
static uint32_t du(const unsigned char *p) {uint32_t v; memcpy(&v,p,4);return v;}
static uint16_t wu(const unsigned char *p) {uint16_t v; memcpy(&v,p,2);return v;}

int main(int argc, char **argv) {
    fallback=argc>1;
    size_t n;
    const unsigned char *exe=read_file("app/launcher.exe",&n);
    page=read_file("docs/index.html",&page_length);
    unsigned nt=du(exe+0x3c);
    const unsigned char *opt=exe+nt+24;
    assert(wu(opt)==0x20b&&wu(opt+68)==2);
    size_t size=du(opt+56);
    unsigned char *base=mmap(NULL,size,PROT_READ|PROT_WRITE|PROT_EXEC,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
    assert(base!=MAP_FAILED);
    const unsigned char *table=opt+wu(exe+nt+20);
    for(unsigned i=0;i<wu(exe+nt+6);i++) {
        const unsigned char *s=table+40*i;
        unsigned va=du(s+12), len=du(s+16), offset=du(s+20);
        assert(va+len<=size&&offset+len<=n);
        if(len) memcpy(base+va,exe+offset,len);
    }
    void **iat=(void **)(base+du(opt+112+12*8));
    void *const pointers[]={env,temp,mkdir_,tempname,create,write_,close_,move_,delete_,convert,exit_,NULL,launch,NULL,message,NULL};
    memcpy(iat,pointers,sizeof pointers);
    void (WINDOWS *entry)(void)=(void *)(base+du(opt+16));
    entry();
    abort();
}
