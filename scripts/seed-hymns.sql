-- Sample hymns for testing LouvorJA streaming and projection
-- Run: sqlite3 ~/Library/Application\ Support/com.louvorja.dev/louvorja.db < scripts/seed-hymns.sql

INSERT OR IGNORE INTO hymns (id, number, title, author, album, lyrics, category) VALUES
(1, 1, 'Amazing Grace', 'John Newton', 'Classic Hymns',
'Verse 1
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

Verse 2
''Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

Verse 3
Through many dangers, toils, and snares
I have already come
''Tis grace hath brought me safe thus far
And grace will lead me home

Verse 4
When we''ve been there ten thousand years
Bright shining as the sun
We''ve no less days to sing God''s praise
Than when we first begun', 'worship'),

(2, 2, 'How Great Thou Art', 'Carl Boberg', 'Classic Hymns',
'Verse 1
O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made
I see the stars, I hear the rolling thunder
Thy power throughout the universe displayed

Chorus
Then sings my soul, my Savior God, to Thee
How great Thou art, how great Thou art
Then sings my soul, my Savior God, to Thee
How great Thou art, how great Thou art

Verse 2
When through the woods and forest glades I wander
And hear the birds sing sweetly in the trees
When I look down from lofty mountain grandeur
And hear the brook and feel the gentle breeze

Verse 3
And when I think that God, His Son not sparing
Sent Him to die, I scarce can take it in
That on the cross, my burden gladly bearing
He bled and died to take away my sin', 'worship'),

(3, 3, 'Great Is Thy Faithfulness', 'Thomas Chisholm', 'Classic Hymns',
'Verse 1
Great is Thy faithfulness, O God my Father
There is no shadow of turning with Thee
Thou changest not, Thy compassions they fail not
As Thou hast been Thou forever wilt be

Chorus
Great is Thy faithfulness
Great is Thy faithfulness
Morning by morning new mercies I see
All I have needed Thy hand hath provided
Great is Thy faithfulness, Lord unto me

Verse 2
Summer and winter, and springtime and harvest
Sun, moon, and stars in their courses above
Join with all nature in manifold witness
To Thy great faithfulness, mercy, and love', 'worship'),

(4, 10, 'Holy, Holy, Holy', 'Reginald Heber', 'Classic Hymns',
'Verse 1
Holy, holy, holy! Lord God Almighty
Early in the morning our song shall rise to Thee
Holy, holy, holy! Merciful and mighty
God in three persons, blessed Trinity

Verse 2
Holy, holy, holy! All the saints adore Thee
Casting down their golden crowns around the glassy sea
Cherubim and seraphim falling down before Thee
Which wert and art and evermore shall be

Verse 3
Holy, holy, holy! Though the darkness hide Thee
Though the eye of sinful man Thy glory may not see
Only Thou art holy, there is none beside Thee
Perfect in power, in love, and purity', 'worship'),

(5, 15, 'Be Thou My Vision', 'Dallan Forgaill', 'Classic Hymns',
'Verse 1
Be Thou my vision, O Lord of my heart
Naught be all else to me, save that Thou art
Thou my best thought, by day or by night
Waking or sleeping, Thy presence my light

Verse 2
Be Thou my wisdom, and Thou my true word
I ever with Thee and Thou with me, Lord
Thou my great Father, and I Thy true son
Thou in me dwelling and I with Thee one

Verse 3
Riches I heed not, nor vain empty praise
Thou mine inheritance, now and always
Thou and Thou only first in my heart
High King of heaven, my treasure Thou art', 'worship'),

(6, 20, 'It Is Well With My Soul', 'Horatio Spafford', 'Classic Hymns',
'Verse 1
When peace like a river attendeth my way
When sorrows like sea billows roll
Whatever my lot, Thou hast taught me to say
It is well, it is well with my soul

Chorus
It is well with my soul
It is well, it is well with my soul

Verse 2
Though Satan should buffet, though trials should come
Let this blessed assurance control
That Christ hath regarded my helpless estate
And hath shed His own blood for my soul

Verse 3
My sin, oh the bliss of this glorious thought
My sin, not in part but the whole
Is nailed to the cross, and I bear it no more
Praise the Lord, praise the Lord, O my soul', 'worship'),

(7, 25, 'Blessed Assurance', 'Fanny Crosby', 'Classic Hymns',
'Verse 1
Blessed assurance, Jesus is mine
Oh what a foretaste of glory divine
Heir of salvation, purchase of God
Born of His Spirit, washed in His blood

Chorus
This is my story, this is my song
Praising my Savior all the day long
This is my story, this is my song
Praising my Savior all the day long

Verse 2
Perfect submission, perfect delight
Visions of rapture now burst on my sight
Angels descending, bring from above
Echoes of mercy, whispers of love', 'worship'),

(8, 30, 'A Mighty Fortress Is Our God', 'Martin Luther', 'Classic Hymns',
'Verse 1
A mighty fortress is our God
A bulwark never failing
Our helper He, amid the flood
Of mortal ills prevailing
For still our ancient foe
Doth seek to work us woe
His craft and power are great
And armed with cruel hate
On earth is not his equal

Verse 2
Did we in our own strength confide
Our striving would be losing
Were not the right Man on our side
The Man of God''s own choosing
Dost ask who that may be?
Christ Jesus, it is He
Lord Sabaoth His name
From age to age the same
And He must win the battle', 'worship');

-- Populate FTS index
INSERT OR IGNORE INTO hymns_fts (rowid, title, lyrics, author, album)
SELECT id, title, COALESCE(lyrics,''), COALESCE(author,''), COALESCE(album,'') FROM hymns;
