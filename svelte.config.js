import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			'@components': 'src/routes/components',
			'@stores': 'src/routes/lib/stores',
			'@utils': 'src/utils.js',
		},
	}
};

export default config;
