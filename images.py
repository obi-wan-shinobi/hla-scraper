import os
from PIL import Image

cntr = 1

dir = 'data/objects/'

print('Transfering images...')
for folder in os.listdir(dir):
    if(len(os.listdir(os.path.join(dir,folder))) > 1):
        for image in os.listdir(os.path.join(dir,folder)):
            try:
                img = Image.open(os.path.join(dir,folder,image))
                img.save(f'data/images/image_{cntr}.jpg')
                cntr+=1
                if(cntr%5000 == 0):
                    print(f'{cntr} images done...')
            except:
                continue
