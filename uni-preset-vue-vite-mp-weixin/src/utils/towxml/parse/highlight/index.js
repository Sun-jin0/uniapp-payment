// 简化版 highlight.js - 避免复杂的模块加载
const hljs = require('./highlight');

// 简化的语言定义
const languages = {
    'c-like': function(hljs) {
        return {
            aliases: ['c', 'cc', 'h', 'c++', 'h++', 'hpp', 'hh', 'hxx', 'cxx'],
            keywords: {
                keyword: 'int float while private char catch import module export virtual operator sizeof dynamic_cast|10 typedef const_cast|10 const for static_cast|10 union namespace unsigned long volatile static protected bool template mutable if public friend do goto auto void enum else break extern using asm case typeid wchar_t short reinterpret_cast|10 default double register explicit signed typename try this switch continue inline delete alignas alignof constexpr consteval constinit decltype concept co_await co_return co_yield requires noexcept static_assert thread_local restrict final override atomic_bool atomic_char atomic_schar atomic_uchar atomic_short atomic_ushort atomic_int atomic_uint atomic_long atomic_ulong atomic_llong atomic_ullong new throw return and and_eq bitand bitor compl not not_eq or or_eq xor xor_eq',
                built_in: 'std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap array shared_ptr abort terminate abs acos asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan vfprintf vprintf vsprintf endl initializer_list unique_ptr _Bool complex _Complex imaginary _Imaginary',
                literal: 'true false nullptr NULL'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE
            ]
        };
    },
    'c': function(hljs) {
        return {
            name: 'C',
            aliases: ['c', 'h'],
            keywords: {
                keyword: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local',
                type: 'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t size_t ssize_t intptr_t uintptr_t',
                literal: 'true false NULL'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE
            ]
        };
    },
    'bash': function(hljs) {
        return {
            name: 'Bash',
            aliases: ['sh', 'zsh'],
            contains: [
                {
                    className: 'shebang',
                    begin: /^#![^\n]+sh\s*$/,
                    relevance: 10
                },
                hljs.C_LINE_COMMENT_MODE,
                hljs.HASH_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                {
                    className: 'variable',
                    begin: /\$[a-zA-Z_]\w*/
                }
            ]
        };
    },
    'css': function(hljs) {
        return {
            name: 'CSS',
            case_insensitive: true,
            contains: [
                hljs.C_BLOCK_COMMENT_MODE,
                {
                    className: 'selector-attr',
                    begin: '\[',
                    end: '\]'
                },
                {
                    className: 'selector-pseudo',
                    begin: ':[a-zA-Z-]+'
                },
                {
                    className: 'selector-class',
                    begin: '\.[a-zA-Z_-]+'
                },
                {
                    className: 'selector-id',
                    begin: '#[a-zA-Z_-]+'
                },
                {
                    className: 'attribute',
                    begin: '[a-zA-Z-]+',
                    end: ':',
                    excludeEnd: true
                }
            ]
        };
    },
    'javascript': function(hljs) {
        return {
            name: 'JavaScript',
            aliases: ['js', 'jsx'],
            keywords: {
                keyword: 'break case catch continue debugger default delete do else finally for function if in instanceof new return switch this throw try typeof var void while with let const class export extends import super yield await',
                literal: 'true false null undefined NaN Infinity',
                built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Error EvalError InternalError RangeError ReferenceError StopIteration SyntaxError TypeError URIError Number Math Date String RegExp Array Float32Array Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect Promise'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE,
                {
                    begin: /`/, end: /`/,
                    contains: [
                        hljs.BACKSLASH_ESCAPE,
                        {
                            className: 'subst',
                            begin: /\$\{/, end: /\}/
                        }
                    ]
                }
            ]
        };
    },
    'json': function(hljs) {
        return {
            name: 'JSON',
            contains: [
                hljs.QUOTE_STRING_MODE,
                hljs.C_NUMBER_MODE,
                {
                    className: 'literal',
                    begin: '\b(true|false|null)\b'
                }
            ],
            illegal: '\\S'
        };
    },
    'java': function(hljs) {
        return {
            name: 'Java',
            keywords: {
                keyword: 'abstract continue for new switch assert default goto package synchronized boolean do if private this break double implements protected throw byte else import public throws case enum instanceof return transient catch extends int short try char final interface static void class finally long strictfp volatile const float native super while true false null',
                literal: 'true false null'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE,
                {
                    className: 'annotation',
                    begin: '@[A-Za-z]+'
                }
            ]
        };
    },
    'python': function(hljs) {
        return {
            name: 'Python',
            aliases: ['py'],
            keywords: {
                keyword: 'and as assert break class continue def del elif else except exec finally for from global if import in is lambda nonlocal not or pass print raise return try while with yield False None True',
                built_in: 'Ellipsis NotImplemented abs all any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip __import__'
            },
            contains: [
                hljs.HASH_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE,
                {
                    className: 'string',
                    begin: /'''/, end: /'''/
                },
                {
                    className: 'string',
                    begin: /"""/, end: /"""/
                }
            ]
        };
    },
    'xml': function(hljs) {
        return {
            name: 'XML',
            aliases: ['html'],
            case_insensitive: true,
            contains: [
                {
                    className: 'meta',
                    begin: '<!DOCTYPE', end: '>',
                    relevance: 10
                },
                {
                    className: 'comment',
                    begin: '<!--', end: '-->'
                },
                {
                    className: 'tag',
                    begin: '</?', end: '/?>',
                    contains: [
                        {
                            className: 'name',
                            begin: /[^\s>\/]+/
                        },
                        {
                            className: 'attr',
                            begin: /[^\s>=]+/,
                            end: '=',
                            excludeEnd: true
                        },
                        {
                            className: 'string',
                            begin: '"', end: '"'
                        },
                        {
                            className: 'string',
                            begin: "'", end: "'"
                        }
                    ]
                }
            ]
        };
    },
    'typescript': function(hljs) {
        return {
            name: 'TypeScript',
            aliases: ['ts'],
            keywords: {
                keyword: 'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with let as implements interface package private protected public static yield abstract any boolean constructor declare get module require number set string symbol type from of',
                literal: 'true false null undefined'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE
            ]
        };
    },
    'go': function(hljs) {
        return {
            name: 'Go',
            aliases: ['golang'],
            keywords: {
                keyword: 'break default func interface select case map struct chan else goto package switch const fallthrough if range type continue for import return var go defer bool byte complex64 complex128 float32 float64 int8 int16 int32 int64 string uint8 uint16 uint32 uint64 int uint uintptr rune',
                literal: 'true false iota nil'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE
            ]
        };
    },
    'php': function(hljs) {
        return {
            name: 'PHP',
            case_insensitive: true,
            keywords: {
                keyword: '__halt_compiler abstract and array as break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile eval exit extends final finally for foreach function global goto if implements include include_once instanceof insteadof interface isset list namespace new or print private protected public require require_once return static switch throw trait try unset use var while xor yield',
                literal: 'true false null'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.HASH_COMMENT_MODE,
                {
                    className: 'comment',
                    begin: '/\\*', end: '\\*/'
                },
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE,
                {
                    begin: '<<<\\s*(?=\\w)',
                    end: '\\w+;?'
                }
            ]
        };
    },
    'shell': function(hljs) {
        return languages['bash'](hljs);
    },
    'htmlbars': function(hljs) {
        return languages['xml'](hljs);
    },
    'nginx': function(hljs) {
        return {
            name: 'Nginx',
            contains: [
                hljs.HASH_COMMENT_MODE,
                {
                    className: 'section',
                    begin: /[a-zA-Z_]+/,
                    end: /\{/,
                    excludeEnd: true
                },
                {
                    className: 'string',
                    begin: '"', end: '"'
                },
                {
                    className: 'string',
                    begin: "'", end: "'"
                }
            ]
        };
    },
    'scss': function(hljs) {
        return languages['css'](hljs);
    },
    'less': function(hljs) {
        return languages['css'](hljs);
    },
    'python-repl': function(hljs) {
        return languages['python'](hljs);
    },
    'dart': function(hljs) {
        return {
            name: 'Dart',
            keywords: {
                keyword: 'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for Function get hide if implements import in inferface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield',
                literal: 'true false null'
            },
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_NUMBER_MODE
            ]
        };
    }
};

// 注册所有语言
Object.keys(languages).forEach(name => {
    hljs.registerLanguage(name, languages[name]);
});

module.exports = hljs;
