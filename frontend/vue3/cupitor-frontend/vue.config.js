module.exports = {
    lintOnSave: false,
	  chainWebpack: config => {
      config.plugins.delete('fork-ts-checker')
		      // config
		      //   .plugin('fork-ts-checker')
		      //   .tap(args => {
				  //       args[0].tsconfig = './tsconfig.json';
				  //       return args;
				  //     });
		}
};
