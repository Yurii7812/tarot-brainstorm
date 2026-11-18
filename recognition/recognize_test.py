"""Card recognition experiment: match cropped card photos against reference scans (SIFT).

Usage (from the project root):
    pip install opencv-python-headless
    python3 recognition/recognize_test.py

Result on the sample photo (7 cards): 7/7 top-1 correct. See docs/HANDOFF.md.
Crops in test-data/crops were cut by hand from the photo; automatic card
detection / segmentation is NOT implemented yet.
"""
import glob
import os

import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
REF_DIR = os.path.join(HERE, "..", "assets", "cards", "rider-waite-720px")
QUERY_DIR = os.path.join(HERE, "..", "test-data", "crops")

sift = cv2.SIFT_create(nfeatures=800)
bf = cv2.BFMatcher()


def describe(path):
    im = cv2.imread(path, 0)
    im = cv2.resize(im, (240, 400))
    return sift.detectAndCompute(im, None)[1]


def good_matches(d1, d2):
    if d1 is None or d2 is None or len(d1) < 2 or len(d2) < 2:
        return 0
    m = bf.knnMatch(d1, d2, k=2)
    return sum(1 for p in m if len(p) == 2 and p[0].distance < 0.75 * p[1].distance)


refs = {os.path.basename(f)[:-4]: describe(f) for f in sorted(glob.glob(REF_DIR + "/*.jpg"))}
print(len(refs), "reference images")

for q in sorted(glob.glob(QUERY_DIR + "/*.png")):
    d = describe(q)
    top = sorted(((good_matches(d, r), n) for n, r in refs.items()), reverse=True)[:3]
    print(os.path.basename(q), top)
