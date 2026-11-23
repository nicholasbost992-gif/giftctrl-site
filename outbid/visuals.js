'use strict';
// Strict visual matching: photos only for known product types. An item-specific
// icon is better than a photo of a completely different product.
// These are illustrative stock photos, NOT photos of a specific auction lot.
const VERIFIED_TYPE_PHOTOS=Object.freeze({
 car:'photo-1503376780353-7e6692767b70',
 sportscar:'photo-1494976388531-d1058494cdd8',
 dirtbike:'photo-1660337293589-245deac79977',
 motorcycle:'photo-1558981806-ec527fa84c39',
 watch:'photo-1523275335684-37898b6baf30',
 sneaker:'photo-1542291026-7eec264c27ff',
 phone:'photo-1511707171634-5f897ff02aa9',
 computer:'photo-1646470743228-78ca5a27c9b5',
 laptop:'photo-1517336714731-489689fd1ca8',
 camera:'photo-1516035069371-29a1b244cc32',
 gaming:'photo-1552820728-8b83bb6b773f',
 jewelry:'photo-1515562141207-7a88fb7ce338',
 painting:'photo-1579783902614-a3fb3927b6a5',
 furniture:'photo-1555041469-a586c61ea9bc',
 plant:'photo-1416879595882-3373a0480b5b',
 music:'photo-1511379938547-c1f69419868d',
 racing:'photo-1461896836934-ffe607ba8211'
});
const iconRules=[
 [/\b(battery|battery pack|power bank)\b/i,'🔋'],
 [/\b(helmet)\b/i,'🪖'],
 [/\b(seat|chair|recliner)\b/i,'🪑'],
 [/\b(key set|key fob|keys|lockbox)\b/i,'🗝️'],
 [/\b(controller|joystick|gamepad)\b/i,'🎮'],
 [/\b(keyboard|keycaps)\b/i,'⌨️'],
 [/\b(router|antenna|wi-fi)\b/i,'📡'],
 [/\b(printer|scanner)\b/i,'🖨️'],
 [/\b(monitor|screen|television|tv|display)\b/i,'🖥️'],
 [/\b(camera|camcorder|film lens|tripod)\b/i,'📷'],
 [/\b(tablet|ipad)\b/i,'📱'],
 [/\b(phone|smartphone|handset)\b/i,'📱'],
 [/\b(headphone|headset|earbuds)\b/i,'🎧'],
 [/\b(microphone|microphone)\b/i,'🎤'],
 [/\b(speaker|subwoofer|boombox)\b/i,'🔊'],
 [/\b(watch|chronograph|timepiece|chronometer)\b/i,'⌚'],
 [/\b(shoe|sneaker|trainer|cleat)\b/i,'👟'],
 [/\b(belt|wallet)\b/i,'👛'],
 [/\b(hoodie|jacket|coat|parka|puffer)\b/i,'🧥'],
 [/\b(bag|backpack|duffel|luggage|suitcase|briefcase)\b/i,'🧳'],
 [/\b(boot)\b/i,'🥾'],
 [/\b(sofa|sectional)\b/i,'🛋️'],
 [/\b(lamp|lighting)\b/i,'💡'],
 [/\b(air fryer|coffee|espresso|roaster|brewing)\b/i,'☕'],
 [/\b(skateboard|longboard)\b/i,'🛹'],
 [/\b(bike|bicycle|moto|motorcycle|moped|scooter)\b/i,'🏍️'],
 [/\b(bumper|car|coupe|sedan|roadster|supercar|convertible)\b/i,'🚗'],
 [/\b(engine|motor|gearbox)\b/i,'⚙️'],
 [/\b(ring)\b/i,'💍'],
 [/\b(painting|canvas|watercolor|art print|artwork)\b/i,'🖼️'],
 [/\b(fossil|meteorite|geode|mineral)\b/i,'🪨'],
 [/\b(guitar|bass guitar)\b/i,'🎸'],
 [/\b(piano|keyboard instrument|synthesizer)\b/i,'🎹'],
 [/\b(drums|percussion)\b/i,'🥁'],
 [/\b(fishing)\b/i,'🎣'],
 [/\b(board game|chess|backgammon)\b/i,'♟️'],
 [/\b(safe|strongbox|locker|crate|sealed box|mystery box)\b/i,'📦']
];
function iconFor(name,fallback='❓'){
 for(const [pattern,emoji]of iconRules)if(pattern.test(name))return emoji;
 return fallback;
}
const photoRules=[
 // Clearly match an item's PRODUCT TYPE, never its broad parent category.
 [/^(LUXURY WATCHES)$/,/\b(watch|chronograph|timepiece|chronometer)\b/i,'watch'],
 [/^(SNEAKERS)$/,/\b(sneaker|trainer|shoes|high-top|low-top|runners|cleats)\b/i,'sneaker'],
 [/^(PHONES & TABLETS)$/,/\b(phone|smartphone|handset|cellphone)\b/i,'phone'],
 [/^(PC & COMPUTING)$/,/\b(computer|pc|desktop|workstation|gaming desk|monitor)\b/i,'computer'],
 [/^(PC & COMPUTING)$/,/\b(laptop)\b/i,'laptop'],
 [/^(CAMERA EQUIPMENT)$/,/\b(camera|camcorder)\b/i,'camera'],
 [/^(GAMING CONSOLES)$/,/\b(console|controller|gaming system|gamepad)\b/i,'gaming'],
 [/^(JEWELRY)$/,/\b(necklace|bracelet|earrings|ring|pendant|brooch)\b/i,'jewelry'],
 [/^(FINE ART)$/,/\b(painting|canvas|oil painting|portrait|watercolor|screenprint)\b/i,'painting'],
 [/^(SPORTS CARS)$/,/\b(coupe|roadster|sport sedan|hatchback|sports car|hot hatch)\b/i,'sportscar'],
 [/^(SUPERCARS)$/,/\b(coupe|supercar|hypercar|spyder|roadster|racing car|grand tourer)\b/i,'car'],
 [/^(CLASSIC CARS)$/,/\b(car|coupe|convertible|roadster|wagon|sedan|fastback|hatch)\b/i,'sportscar'],
 [/^(MOTORCYCLES)$/,/\b(dirt bike|motocross|supermoto|enduro|trail bike|off-road)\b/i,'dirtbike'],
 [/^(MOTORCYCLES)$/,/\b(motorcycle|sport bike|streetfighter|chopper|cafe racer|cruiser)\b/i,'motorcycle'],
 [/^(HOME & DECOR)$/,/\b(sofa|sectional|recliner)\b/i,'furniture'],
 [/^(GARDEN & NATURAL)$/,/\b(plant|tree|cactus|orchid|bonsai)\b/i,'plant'],
 [/^(MUSICAL INSTRUMENTS)$/,/\b(instrument|guitar|synth|studio)\b/i,'music']
];
// Never use a picture of a petrol dirt bike to represent an electric motorcycle,
// or a sports car photograph to stand in for an E-MOTO part.
function visualFor({name,category,emoji,junk=false}){
 const icon=iconFor(name,emoji);
 if(junk)return {image:null,emoji:icon};
 const rule=photoRules.find(([cat,word])=>cat.test(category)&&word.test(name));
 return {image:rule?VERIFIED_TYPE_PHOTOS[rule[2]]:null,emoji:icon};
}
module.exports={visualFor,VERIFIED_TYPE_PHOTOS};
