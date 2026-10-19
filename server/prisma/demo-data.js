// ============================================================
// 演示数据：20 个分类 × 5 条 = 100 条公开站点
// 全部是公开可访问的网站，不含任何私人收藏
// 格式：[名称, 网址, 一句话描述]
// 想加自己的站点：直接在对应分类的数组里增删即可
// ============================================================

export const DEMO_DATA = [
  {
    name: '常用网站',
    slug: 'common',
    sites: [
      ['百度', 'https://www.baidu.com', '中文搜索引擎'],
      ['Google', 'https://www.google.com', '全球搜索引擎'],
      ['知乎', 'https://www.zhihu.com', '有问题就会有答案'],
      ['哔哩哔哩', 'https://www.bilibili.com', '年轻人的视频社区'],
      ['微博', 'https://weibo.com', '中文社交媒体']
    ]
  },
  {
    name: 'AI 工具',
    slug: 'ai',
    sites: [
      ['ChatGPT', 'https://chat.openai.com', 'OpenAI 对话助手'],
      ['Claude', 'https://claude.ai', 'Anthropic 对话助手'],
      ['DeepSeek', 'https://chat.deepseek.com', '国产开源大模型'],
      ['通义千问', 'https://tongyi.aliyun.com', '阿里大模型'],
      ['Midjourney', 'https://www.midjourney.com', 'AI 绘画']
    ]
  },
  {
    name: '开发工具',
    slug: 'dev',
    sites: [
      ['GitHub', 'https://github.com', '全球最大代码托管'],
      ['Stack Overflow', 'https://stackoverflow.com', '程序员问答'],
      ['npm', 'https://www.npmjs.com', 'Node 包管理'],
      ['Docker Hub', 'https://hub.docker.com', '镜像仓库'],
      ['Postman', 'https://www.postman.com', '接口调试']
    ]
  },
  {
    name: '技术官网',
    slug: 'tech',
    sites: [
      ['Vue', 'https://vuejs.org', '渐进式前端框架'],
      ['React', 'https://react.dev', '组件化 UI 库'],
      ['Node.js', 'https://nodejs.org', 'JS 运行时'],
      ['TypeScript', 'https://www.typescriptlang.org', 'JS 类型超集'],
      ['Tailwind CSS', 'https://tailwindcss.com', '原子化 CSS']
    ]
  },
  {
    name: '设计资源',
    slug: 'design',
    sites: [
      ['Figma', 'https://www.figma.com', '在线协作设计'],
      ['Dribbble', 'https://dribbble.com', '设计师作品集'],
      ['Unsplash', 'https://unsplash.com', '免费高清图库'],
      ['iconfont', 'https://www.iconfont.cn', '阿里图标库'],
      ['TinyPNG', 'https://tinypng.com', '图片压缩']
    ]
  },
  {
    name: '云服务',
    slug: 'cloud',
    sites: [
      ['阿里云', 'https://www.aliyun.com', '国内云厂商'],
      ['腾讯云', 'https://cloud.tencent.com', '国内云厂商'],
      ['Cloudflare', 'https://www.cloudflare.com', 'CDN 与防护'],
      ['Vercel', 'https://vercel.com', '前端部署平台'],
      ['Supabase', 'https://supabase.com', '开源 BaaS']
    ]
  },
  {
    name: '网盘存储',
    slug: 'storage',
    sites: [
      ['百度网盘', 'https://pan.baidu.com', '国内主流网盘'],
      ['阿里云盘', 'https://www.alipan.com', '不限速网盘'],
      ['夸克网盘', 'https://pan.quark.cn', '夸克网盘'],
      ['Google Drive', 'https://drive.google.com', '谷歌云盘'],
      ['OneDrive', 'https://onedrive.live.com', '微软云盘']
    ]
  },
  {
    name: '影音娱乐',
    slug: 'media',
    sites: [
      ['YouTube', 'https://www.youtube.com', '全球视频平台'],
      ['Netflix', 'https://www.netflix.com', '流媒体影视'],
      ['爱奇艺', 'https://www.iqiyi.com', '综合视频'],
      ['网易云音乐', 'https://music.163.com', '音乐社区'],
      ['Spotify', 'https://open.spotify.com', '全球流媒体音乐']
    ]
  },
  {
    name: '游戏',
    slug: 'game',
    sites: [
      ['Steam', 'https://store.steampowered.com', '全球最大游戏平台'],
      ['Epic Games', 'https://www.epicgames.com', 'Epic 商城'],
      ['小黑盒', 'https://www.xiaoheihe.cn', '游戏玩家社区'],
      ['IGN', 'https://www.ign.com', '游戏评测'],
      ['Nexus Mods', 'https://www.nexusmods.com', '模组下载']
    ]
  },
  {
    name: '软件下载',
    slug: 'software',
    sites: [
      ['腾讯软件中心', 'https://pc.qq.com', '腾讯软件下载'],
      ['果核剥壳', 'https://www.ghxi.com', '绿色软件分享'],
      ['SourceForge', 'https://sourceforge.net', '开源软件托管'],
      ['Ninite', 'https://ninite.com', '批量装常用软件'],
      ['Chocolatey', 'https://chocolatey.org', 'Windows 包管理']
    ]
  },
  {
    name: '效率工具',
    slug: 'productivity',
    sites: [
      ['Notion', 'https://www.notion.so', '全能笔记协作'],
      ['语雀', 'https://www.yuque.com', '阿里知识库'],
      ['飞书', 'https://www.feishu.cn', '字节办公套件'],
      ['滴答清单', 'https://dida365.com', '待办与日程'],
      ['Obsidian', 'https://obsidian.md', '本地知识库']
    ]
  },
  {
    name: '学习成长',
    slug: 'learn',
    sites: [
      ['Coursera', 'https://www.coursera.org', '名校在线课程'],
      ['中国大学MOOC', 'https://www.icourse163.org', '国内高校课程'],
      ['掘金', 'https://juejin.cn', '开发者社区'],
      ['菜鸟教程', 'https://www.runoob.com', '入门教程'],
      ['维基百科', 'https://zh.wikipedia.org', '自由百科全书']
    ]
  },
  {
    name: '资讯阅读',
    slug: 'news',
    sites: [
      ['36氪', 'https://36kr.com', '科技创投媒体'],
      ['InfoQ', 'https://www.infoq.cn', '技术资讯'],
      ['Hacker News', 'https://news.ycombinator.com', '极客新闻'],
      ['Product Hunt', 'https://www.producthunt.com', '新产品发现'],
      ['财新网', 'https://www.caixin.com', '财经新闻']
    ]
  },
  {
    name: '社区论坛',
    slug: 'community',
    sites: [
      ['虎扑', 'https://www.hupu.com', '体育与生活社区'],
      ['机核', 'https://www.gcores.com', '游戏文化'],
      ['果壳', 'https://www.guokr.com', '泛科学社区'],
      ['汽车之家', 'https://www.autohome.com.cn', '汽车资讯社区'],
      ['Reddit', 'https://www.reddit.com', '海外论坛聚合']
    ]
  },
  {
    name: '购物消费',
    slug: 'shopping',
    sites: [
      ['天猫', 'https://www.tmall.com', '品牌购物'],
      ['拼多多', 'https://www.pinduoduo.com', '社交电商'],
      ['闲鱼', 'https://2.taobao.com', '二手交易'],
      ['得物', 'https://www.dewu.com', '潮流正品'],
      ['山姆会员店', 'https://www.samsclub.cn', '会员制超市']
    ]
  },
  {
    name: '生活服务',
    slug: 'life',
    sites: [
      ['12306', 'https://www.12306.cn', '铁路购票'],
      ['高德地图', 'https://www.amap.com', '导航地图'],
      ['携程', 'https://www.ctrip.com', '旅行预订'],
      ['美团', 'https://www.meituan.com', '本地生活'],
      ['快递100', 'https://www.kuaidi100.com', '快递查询']
    ]
  },
  {
    name: '金融财经',
    slug: 'finance',
    sites: [
      ['东方财富', 'https://www.eastmoney.com', '财经门户'],
      ['雪球', 'https://xueqiu.com', '投资交流'],
      ['同花顺', 'https://www.10jqka.com.cn', '行情软件'],
      ['上海证券交易所', 'https://www.sse.com.cn', '上交所'],
      ['天天基金', 'https://fund.eastmoney.com', '基金数据']
    ]
  },
  {
    name: '政务公开',
    slug: 'gov',
    sites: [
      ['中国政府网', 'https://www.gov.cn', '国务院门户'],
      ['国家政务服务平台', 'https://gjzwfw.www.gov.cn', '一网通办'],
      ['教育部', 'https://www.moe.gov.cn', '教育部'],
      ['国家税务总局', 'https://www.chinatax.gov.cn', '税务总局'],
      ['国家医保局', 'https://www.nhsa.gov.cn', '医保局']
    ]
  },
  {
    name: '邮箱通讯',
    slug: 'mail',
    sites: [
      ['Gmail', 'https://mail.google.com', '谷歌邮箱'],
      ['QQ邮箱', 'https://mail.qq.com', '腾讯邮箱'],
      ['163邮箱', 'https://mail.163.com', '网易邮箱'],
      ['Telegram', 'https://telegram.org', '加密聊天'],
      ['腾讯会议', 'https://meeting.tencent.com', '在线会议']
    ]
  },
  {
    name: '实用工具',
    slug: 'tools',
    sites: [
      ['草料二维码', 'https://cli.im', '二维码生成'],
      ['Internet Archive', 'https://archive.org', '互联网档案馆'],
      ['Speedtest', 'https://www.speedtest.net', '网速测试'],
      ['天眼查', 'https://www.tianyancha.com', '企业信息查询'],
      ['IP138', 'https://www.ip138.com', 'IP 归属地查询']
    ]
  }
];
