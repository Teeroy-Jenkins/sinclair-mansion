import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Murder at Sinclair Mansion',
    description: 'A social deduction game in Sinclair Mansion, built on XRSPS',
    base: '/',
    head: [
        ['meta', { property: 'og:title', content: 'Murder at Sinclair Mansion' }],
        ['meta', { property: 'og:description', content: 'A social deduction game in Sinclair Mansion, built on XRSPS' }],
        ['meta', { name: 'theme-color', content: '#4a9eff' }],
    ],
    themeConfig: {
        logo: '/xrsps.png',
        siteTitle: false,
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Docs', link: '/setup' }
        ],
        sidebar: [
            {
                text: 'Getting Started',
                items: [
                    { text: 'Setup', link: '/setup' },
                    { text: 'Design summary', link: '/design-summary' },
                    { text: 'Developer guide', link: '/developers' },
                    { text: 'FAQ', link: '/faq' },
                ],
            },
            {
                text: 'Documentation',
                items: [
                    { text: 'Architecture', link: '/ARCHITECTURE' },
                    { text: 'Gamemodes', link: '/gamemodes' },
                    { text: 'Extrascripts', link: '/extrascripts' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/Teeroy-Jenkins/sinclair-mansion' },
        ],
        footer: {
            message: 'Fan project. Not affiliated with Jagex Ltd.',
        },
        editLink: {
            pattern: 'https://github.com/Teeroy-Jenkins/sinclair-mansion/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
    },
});
