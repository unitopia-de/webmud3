
export function getBaseLocation():string {
  let paths: string[] = location.pathname.split('/').splice(1, 1);
  // console.log("paths:",location.pathname);
  let basePath: string = (paths && paths[0]) || '';
  // console.log("href:",basePath);
  switch (basePath) {
    case 'webmud3':
    case 'webmud3test':
      return '/' + basePath + '/';
    default:
      return '/';
  }

}
