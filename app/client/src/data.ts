const rebates = [
  {
    id: 1,
    name: "Alfa",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris suscipit est metus, luctus suscipit orci varius a. Praesent semper leo ut risus ullamcorper tempor. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Pellentesque blandit risus et tellus dapibus scelerisque. Mauris imperdiet hendrerit velit. Nulla laoreet, eros sit amet efficitur fermentum, lorem neque congue erat, a convallis magna nulla venenatis metus. Aenean iaculis eros ac euismod blandit. Nullam vel purus sed arcu varius vestibulum.",
  },
  {
    id: 2,
    name: "Bravo",
    text: "Donec mollis ligula nibh, non lacinia mi molestie et. Proin elit libero, tincidunt sed magna eget, lacinia cursus nibh. Cras sit amet tortor viverra, porttitor dui congue, finibus nulla. Ut luctus, nisi sed viverra convallis, augue massa vehicula arcu, sed sagittis metus eros ac metus. Curabitur sit amet sodales diam. Nullam pulvinar arcu quam, sit amet blandit erat tincidunt ut. Aliquam in dolor quis elit tincidunt vestibulum. Aenean sagittis dictum nulla non dapibus. Etiam tristique finibus nunc vel egestas. Nulla a augue vitae sem malesuada lacinia ac eget lacus.",
  },
  {
    id: 3,
    name: "Charlie",
    text: "Aliquam porttitor lacus tincidunt est congue, non lobortis diam vestibulum. Fusce pretium ligula quis iaculis eleifend. Etiam eleifend quam euismod lacus suscipit, a consequat enim tincidunt. Proin ut tortor quis arcu accumsan luctus. Vestibulum tempor nulla in venenatis pellentesque. Pellentesque justo metus, laoreet sit amet vehicula non, malesuada sed odio. Donec urna urna, rhoncus ac ipsum blandit, aliquam ultrices urna. Proin hendrerit, justo ut vestibulum rhoncus, leo quam efficitur enim, vel ornare massa lacus ac metus. Proin sed egestas justo, vitae ultrices massa. Nunc sed sapien ut nunc imperdiet aliquam. Quisque dignissim augue eget egestas hendrerit.",
  },
  {
    id: 4,
    name: "Delta",
    text: "Mauris mi est, tempor ut tempus at, fringilla non erat. Vivamus in efficitur risus. Duis lacus erat, feugiat mollis quam in, facilisis pulvinar enim. Integer gravida venenatis tempus. Aliquam erat volutpat. Integer posuere nulla vel tempus pretium. Nullam at dolor et ex fringilla varius ut vitae nunc. Fusce ornare nulla vitae ante rutrum malesuada. Curabitur rhoncus, libero et dignissim iaculis, augue felis bibendum libero, in hendrerit nulla justo quis justo. Mauris non imperdiet arcu, eu vehicula nibh. Nulla facilisi. Phasellus mi nisl, consequat non lacus vel, laoreet vehicula nunc. Quisque sit amet turpis elementum, pretium enim vel, gravida nisi.",
  },
  {
    id: 5,
    name: "Echo",
    text: "Pellentesque ut finibus leo, a volutpat elit. Suspendisse rhoncus sed arcu pellentesque porttitor. Fusce tempus tortor a magna euismod viverra. Sed malesuada commodo orci, eu auctor elit hendrerit molestie. Integer tincidunt velit eget molestie scelerisque. Nunc tincidunt mollis tellus, et varius felis malesuada eu. Vestibulum vel dolor lacinia turpis aliquet egestas. Integer fringilla mollis feugiat. Integer et nunc interdum, condimentum felis ac, finibus nisi. Sed tempus mollis accumsan. Etiam dui sem, tincidunt eu enim id, tristique viverra purus. Vivamus nulla magna, pretium non turpis ac, elementum tempus neque. Nulla pellentesque velit erat, vitae tempus tellus venenatis et. Suspendisse potenti. Vestibulum nec arcu a lorem cursus efficitur. Vestibulum finibus eu eros nec congue.",
  },
];

export function getRebates() {
  return rebates;
}

export function getRebate(id: number) {
  return rebates.find((rebate) => rebate.id === id);
}
