.section .rodata
.globl web_start
.globl web_end
web_start:
.incbin "docs/index.html"
web_end:

.data
.balign 8
.globl api
api:
.zero 2048
.globl relocation_anchor
relocation_anchor:
.quad start
