// backend/data/shopProducts.js
// Prices in pence

const SHOP_PRODUCTS = [
  {
    id: 'hoodie',
    name: 'Hoodie',
    description: 'Drop shoulder style hoodie in soft cotton-faced fabric. Embroidered with your chosen initials. 80% ringspun cotton / 20% polyester.',
    images: [
      'https://images.sumup.com/img_22BCA1SYJH9NMVPT32FT58KCTN/image.png',
      'https://images.sumup.com/img_4AYE3XNN8V9WQBGPYY8P22MDH1/image.png',
    ],
    variants: [
      { label: 'Kids 3–4', price: 1800 },
      { label: 'Kids 5–6', price: 1800 },
      { label: 'Kids 7–8', price: 1800 },
      { label: 'Kids 9–11', price: 1800 },
      { label: 'Kids 12–13', price: 1800 },
      { label: 'Adult XS', price: 2000 },
      { label: 'Adult S', price: 2000 },
      { label: 'Adult M', price: 2000 },
      { label: 'Adult L', price: 2000 },
      { label: 'Adult XL', price: 2000 },
      { label: 'Adult XXL', price: 2000 },
      { label: 'Adult 3XL', price: 2000 },
      { label: 'Adult 4XL', price: 2000 },
      { label: 'Adult 5XL', price: 2000 },
    ],
    customisation: {
      label: 'Initials',
      placeholder: 'e.g. JW',
      maxLength: 4,
      required: true,
    },
    sizeGuide: {
      sections: [
        {
          title: 'Adult sizes — chest to fit (inches)',
          headers: ['Size', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
          rows: [['Chest (to fit)', '34–36', '38', '40–42', '44–46', '48–50', '52', '54–56', '58']],
        },
        {
          title: 'Kids sizes — chest to fit (inches)',
          headers: ['Age', '3–4', '5–6', '7–8', '9–10', '11–13'],
          rows: [['Chest (to fit)', '24', '26', '28', '30', '32']],
        },
      ],
    },
  },
  {
    id: 'tshirt',
    name: 'T-Shirt',
    description: 'Club training t-shirt embroidered with your chosen initials. 100% ringspun cotton.',
    images: [
      'https://images.sumup.com/img_0QNGX3AH189W98Y3498PCS27Y7/image.png',
    ],
    variants: [
      { label: 'Kids 5–6', price: 1000 },
      { label: 'Kids 7–8', price: 1000 },
      { label: 'Kids 9–11', price: 1000 },
      { label: 'Adult XS', price: 1200 },
      { label: 'Adult S', price: 1200 },
      { label: 'Adult M', price: 1200 },
      { label: 'Adult L', price: 1200 },
      { label: 'Adult XL', price: 1200 },
      { label: 'Adult 2XL', price: 1200 },
      { label: 'Adult 3XL', price: 1200 },
      { label: 'Adult 4XL', price: 1200 },
    ],
    customisation: {
      label: 'Initials',
      placeholder: 'e.g. JW',
      maxLength: 4,
      required: true,
    },
    sizeGuide: {
      sections: [
        {
          title: 'Adult sizes — chest to fit (inches)',
          headers: ['Size', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
          rows: [['Chest (to fit)', '34–36', '38', '40–42', '44–46', '48–50', '52', '54–56', '58']],
        },
        {
          title: 'Kids sizes — chest to fit (inches)',
          headers: ['Age', '1–2', '3–4', '5–6', '7–8', '9–11'],
          rows: [['Chest (to fit)', '24', '26', '28', '30', '32']],
        },
      ],
    },
  },
  {
    id: 'leggings',
    name: 'Leggings',
    description: 'CoolFit performance leggings with UPF 30+ UV protection and hidden key pocket. 87% polyester / 13% elastane. No customisation.',
    images: [
      'https://images.sumup.com/img_4YJ6R13MJ88EC8YWENPPFQ3VM4/image.png',
    ],
    variants: [
      { label: 'Kids 5–6', price: 2300 },
      { label: 'Kids 7–8', price: 2300 },
      { label: 'Kids 9–11', price: 2300 },
      { label: 'Kids 12–13', price: 2300 },
      { label: 'Adult XS (UK 8)', price: 2500 },
      { label: 'Adult S (UK 10)', price: 2500 },
      { label: 'Adult M (UK 12)', price: 2500 },
      { label: 'Adult L (UK 14)', price: 2500 },
      { label: 'Adult XL (UK 16)', price: 2500 },
      { label: 'Adult 2XL', price: 2500 },
      { label: 'Adult 3XL', price: 2500 },
    ],
    customisation: null,
    sizeGuide: {
      sections: [
        {
          title: 'Adult sizes — UK dress size',
          headers: ['Size', 'XS', 'S', 'M', 'L', 'XL'],
          rows: [['UK dress size', '8', '10', '12', '14', '16']],
        },
        {
          title: 'Kids sizes — waist to fit (inches)',
          headers: ['Age', '5–6', '7–8', '9–11', '12–13'],
          rows: [['Waist (to fit)', '20', '22', '24', '26']],
        },
      ],
    },
  },
  {
    id: 'tapered-joggers',
    name: 'Tapered Joggers',
    description: 'AWDis Cool tapered jog pants. Adult sizes only.',
    images: [
      'https://images.sumup.com/img_3HJE2GVPAG81TRW843QPM8VYVN/image.png',
    ],
    variants: [
      { label: 'S', price: 2500 },
      { label: 'M', price: 2500 },
      { label: 'L', price: 2500 },
      { label: 'XL', price: 2500 },
      { label: 'XXL', price: 2500 },
    ],
    customisation: null,
    sizeGuide: {
      sections: [
        {
          title: 'Waist to fit (inches)',
          headers: ['Size', 'S', 'M', 'L', 'XL', 'XXL'],
          rows: [['Waist (to fit)', '30', '32', '34', '36', '38']],
        },
      ],
    },
  },
  {
    id: 'tracksuit-bottoms',
    name: 'Tracksuit Bottoms',
    description: 'Finden and Hales knitted tracksuit pants.',
    images: [
      'https://images.sumup.com/img_71P0D1GE5895XVHBS8JEVCMEA9/image.png',
    ],
    variants: [
      { label: 'Kids 3–4', price: 3000 },
      { label: 'Kids 5–6', price: 3000 },
      { label: 'Kids 7–8', price: 3000 },
      { label: 'Kids 9–11', price: 3000 },
      { label: 'Kids 12–13', price: 3000 },
      { label: 'Adult XS', price: 3000 },
      { label: 'Adult S', price: 3000 },
      { label: 'Adult M', price: 3000 },
      { label: 'Adult L', price: 3000 },
      { label: 'Adult XL', price: 3000 },
      { label: 'Adult XXL', price: 3000 },
    ],
    customisation: null,
    sizeGuide: {
      sections: [
        {
          title: 'Adult sizes — waist to fit (inches)',
          headers: ['Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
          rows: [['Waist (to fit)', '30', '32', '34', '36', '38', '40']],
        },
        {
          title: 'Kids sizes — waist to fit (inches)',
          headers: ['Age', '3–4', '5–6', '7–8', '9–11', '12–13'],
          rows: [['Waist (to fit)', '19', '20', '22', '24', '25']],
        },
      ],
    },
  },
  {
    id: 'shorts',
    name: 'Shorts',
    description: 'AWDis Cool mesh lined shorts.',
    images: [
      'https://images.sumup.com/img_41WH9P192796CBH51AKM5MFCMA/image.png',
    ],
    variants: [
      { label: 'Kids 3–4', price: 1400 },
      { label: 'Kids 5–6', price: 1400 },
      { label: 'Kids 7–8', price: 1400 },
      { label: 'Kids 9–11', price: 1400 },
      { label: 'Kids 12–13', price: 1400 },
      { label: 'Adult S', price: 1400 },
      { label: 'Adult M', price: 1400 },
      { label: 'Adult L', price: 1400 },
      { label: 'Adult XL', price: 1400 },
      { label: 'Adult XXL', price: 1400 },
    ],
    customisation: null,
    sizeGuide: {
      sections: [
        {
          title: 'Adult sizes — waist to fit (inches)',
          headers: ['Size', 'S', 'M', 'L', 'XL', 'XXL'],
          rows: [['Waist (to fit)', '30', '32', '34', '36', '38']],
        },
        {
          title: 'Kids sizes — waist to fit (inches)',
          headers: ['Age', '3–4', '5–6', '7–8', '9–11', '12–13'],
          rows: [['Waist (to fit)', '19', '20', '22', '24', '25']],
        },
      ],
    },
  },
  {
    id: 'womens-leotard',
    name: "Women's Leotard",
    description: 'Bespoke Trampoline Life competition leotard. Purple and black with white detail.',
    images: [
      'https://images.sumup.com/img_4E5G6C2H2R8VDVM5HVVEAGEBRP/image.png',
      'https://images.sumup.com/img_71RQ81DD9X9PR8ATFM1HFJ6GQN/image.png',
    ],
    variants: [
      { label: 'Child 24', price: 7500 },
      { label: 'Child 26', price: 7500 },
      { label: 'Child 28', price: 7500 },
      { label: 'Child 30', price: 7500 },
      { label: 'Child 32', price: 7500 },
      { label: 'Adult 34', price: 7500 },
      { label: 'Adult 36', price: 7500 },
      { label: 'Adult 38', price: 7500 },
    ],
    customisation: null,
    sizeGuide: {
      externalUrl: 'https://www.milano-pro-sport.com/size-guides-i31',
      externalLabel: 'Full size guide on Milano Pro Sport',
      note: 'Measurements in inches. How to measure: A) Chest — measure from fullest part with arms down. B) Waist — narrowest part. C) Torso — centre of shoulder, down through legs and back up. D) Arm — top of shoulder to wrist.',
      sections: [
        {
          title: 'Child sizes',
          headers: ['GB Size', '24', '26', '28', '30', '32'],
          rows: [
            ['Approx Age', '3–4', '5–6', '7–8', '9–10', '11–13'],
            ['A) Chest (in)', '22–24', '23–26', '25–28', '27–30', '29–32'],
            ['B) Waist (in)', '20–21', '20–22', '20–23', '21–24', '22–25'],
            ['C) Torso (in)', '36–38', '38–42', '40–45', '43–47', '47–53'],
            ['D) Arm (in)', '14–15', '14–15.5', '15–17', '17–19', '18–20'],
          ],
        },
        {
          title: 'Adult sizes',
          headers: ['GB Size', '34', '36', '38'],
          rows: [
            ['Approx Age', '13–15', '15+', 'Adult L'],
            ['A) Chest (in)', '31–34', '33–36', '35–38'],
            ['B) Waist (in)', '24–27', '25–27', '26–29'],
            ['C) Torso (in)', '52–56', '56–60', '58–61'],
            ['D) Arm (in)', '19–21', '21–23', '21–23'],
          ],
        },
      ],
    },
  },
  {
    id: 'mens-leotard',
    name: "Men's Leotard",
    description: 'Bespoke Trampoline Life competition leotard. Purple and black with white detail.',
    images: [
      'https://images.sumup.com/img_7SVBN8PE158HBRZQMWQYQQQJCX/image.png',
      'https://images.sumup.com/img_2Q2DDQ9F5H88P8PFXS8TZJG4NA/image.png',
    ],
    variants: [
      { label: '26', price: 5500 },
      { label: '28', price: 5500 },
      { label: '30', price: 5500 },
      { label: '32', price: 5500 },
      { label: '34', price: 5500 },
      { label: '36', price: 5500 },
      { label: '38', price: 5500 },
      { label: '40', price: 5500 },
      { label: '42', price: 5500 },
      { label: '44', price: 5500 },
    ],
    customisation: null,
    sizeGuide: {
      externalUrl: 'https://www.milano-pro-sport.com/size-guides-i31',
      externalLabel: 'Size guide on Milano Pro Sport',
    },
  },
  {
    id: 'scrunchie',
    name: 'Scrunchie',
    description: 'Club scrunchie.',
    images: [
      'https://images.sumup.com/img_00YQDK28WA86GV40QRSMHG4C7Z/image.png',
    ],
    variants: [
      { label: 'One Size', price: 500 },
    ],
    customisation: null,
    sizeGuide: null,
  },
];

module.exports = { SHOP_PRODUCTS };
