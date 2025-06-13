"""
Objective         -   Provide an API endpoint that receives front-end scroll batch payloads,
                      compares them to previous snapshots if present, and saves raw, cleaned,
                      and xpath-only CSV files along with screenshots.
                      
Modules / Functions:
    ExtractDataView     -   Handles POST requests to ingest scroll batches.
    clean_xpath         -   Normalize XPaths by stripping numeric indices.
    save_screenshot     -   Decode base64 image data and save it as a PNG file.
"""

# --------------------------------------- Imports ---------------------------------------
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import re
import os
import base64
from io import BytesIO
from PIL import Image
from datetime import datetime

import sys, os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(BASE_DIR, "llm_integration"))

from llm.llm_segmenter import queue_segmentation


# ---------------------- Base output directory for all scroll batches -------------------
OUTPUT_DIR = "./Outputs/"
os.makedirs(OUTPUT_DIR, exist_ok=True)

class ExtractDataView(APIView):
    """
    API view to process incoming scroll batch data.
    
    - On first batch: saves uncleaned, cleaned, and xpath-only CSVs.
    - On subsequent batches: diffs against previous xpath CSV, flags modifications,
      saves a timestamped modified CSV, and optional screenshot.
    """
    def post(self, request):
        try:
            # Get scroll_index from request or fallback to elements[0]['scrollIndex']
            scroll_index = request.data.get("scroll_index")
            elements = request.data.get("elements", []) or []
            if scroll_index is None and elements:
                first = elements[0]
                if isinstance(first, dict) and "scrollIndex" in first:
                    try:
                        scroll_index = int(first["scrollIndex"])
                    except (ValueError, TypeError):
                        pass
            
            # Return error if scroll_index still missing or invalid
            if scroll_index is None:
                return Response(
                    {"error": "Missing scroll_index in payload or elements"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                scroll_index = int(scroll_index)
            except (ValueError, TypeError):
                return Response(
                    {"error": f"Invalid scroll_index: {scroll_index}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Prepare folder and file paths for this scroll_index
           # website = request.data.get("website", "")
           # site_clean = re.sub(r"[^\w\-]", "_", website.replace("www.", ""))
           # batch_folder = os.path.join(OUTPUT_DIR, f"{site_clean}_scroll_{scroll_index}")
            #os.makedirs(batch_folder, exist_ok=True)

            #uncleaned_csv = os.path.join(batch_folder, f"uncleaned_{site_clean}_{scroll_index}.csv")
            #cleaned_csv   = os.path.join(batch_folder, f"cleaned_{site_clean}_{scroll_index}.csv")
           # xpath_csv     = os.path.join(batch_folder, f"xpath_{site_clean}_{scroll_index}.csv")
            #screenshot_data = request.data.get("screenshot")

            website = request.data.get("website", "")
            site_clean = re.sub(r"[^\w\-]", "_", website.replace("www.", ""))
            site_folder = os.path.join(OUTPUT_DIR, site_clean)
            os.makedirs(site_folder, exist_ok=True)
            scroll_folder = os.path.join(site_folder, f"scroll_{scroll_index}")
            os.makedirs(scroll_folder, exist_ok=True)
            uncleaned_csv = os.path.join(scroll_folder, f"uncleaned_{site_clean}_{scroll_index}.csv")
            cleaned_csv   = os.path.join(scroll_folder, f"cleaned_{site_clean}_{scroll_index}.csv")
            xpath_csv     = os.path.join(scroll_folder, f"xpath_{site_clean}_{scroll_index}.csv")
            screenshot_data = request.data.get("screenshot")


            # Load incoming elements into a DataFrame
            df_current = pd.DataFrame(elements)

            # If an xpath CSV already exists, treat this as a modification event
            if os.path.exists(xpath_csv):
                # Read previous snapshot
                prev_df = pd.read_csv(xpath_csv, dtype=str)
                # Compare full rows to detect changes
                curr_cmp = df_current.astype(str)
                prev_cmp = prev_df.astype(str)

                diff = curr_cmp.merge(
                    prev_cmp.drop_duplicates(), how="left", indicator=True
                )
                modified = diff[diff['_merge'] != 'both'].drop(columns=['_merge'])
                if modified.empty:
                    return Response(
                        {"message": "No changes detected for scroll {scroll_index}"},
                        status=status.HTTP_200_OK
                    )
                # Flag with current scroll_index, remove any existing scroll columns
                modified['flagged_scroll_index'] = scroll_index
                for col in ('scroll_index', 'scrollIndex'):
                    if col in modified.columns:
                        modified.drop(columns=[col], inplace=True)
                # Save modified rows to a timestamped CSV
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                modified_csv = os.path.join(
                    scroll_folder,
                    f"modified_{site_clean}_{scroll_index}_{ts}.csv"
                )
                modified.to_csv(modified_csv, index=False, encoding='utf-8')

                # Save a separate image for this modification
                screenshot_file = None
                if screenshot_data:
                    screenshot_file = save_screenshot(
                        screenshot_data,
                        site_clean,
                        scroll_folder,
                        f"modified_{scroll_index}_{ts}"
                    )
                return Response(
                    {
                        "message": "Modifications saved",
                        "modified_csv": modified_csv,
                        "rows_modified": len(modified),
                        "screenshot": screenshot_file
                    },
                    status=status.HTTP_200_OK
                )

            # Initial load: save full batch to uncleaned, cleaned, and xpath-only CSVs
            # Uncleaned CSV
            df_current.to_csv(uncleaned_csv, index=False, encoding='utf-8')

            # Clean XPaths and save cleaned CSV
            df_current['original_xpath'] = df_current['xpath']
            df_current['xpath'] = df_current['xpath'].apply(clean_xpath)
            df_current.to_csv(cleaned_csv, index=False, encoding='utf-8')
            
            # XPath-only CSV
            xpath_df = df_current[
                ['webElementId', 'original_xpath', 'xpath', 'text']
            ]
            xpath_df.to_csv(xpath_csv, index=False, encoding='utf-8')
            queue_segmentation(xpath_csv)

            # Save screenshot if provided
            screenshot_file = None
            if screenshot_data:
                screenshot_file = save_screenshot(
                    screenshot_data,
                    site_clean,
                    scroll_folder,
                    scroll_index
                )

            # Return success response with file paths and row count
            return Response(
                {
                    "message": "Scroll batch saved",
                    "uncleaned_csv": uncleaned_csv,
                    "cleaned_csv": cleaned_csv,
                    "xpath_csv": xpath_csv,
                    "rows_total": len(df_current),
                    "screenshot": screenshot_file
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

def clean_xpath(xpath: str) -> str:
    """
    Remove numeric subscripts (e.g., [1], [2]) and trailing numeric segments from an XPath string.
    """
    xpath = re.sub(r"\[\d+\]", "", xpath)
    xpath = re.sub(r"/\d+", "", xpath)
    return xpath


def save_screenshot(base64_string: str, site_clean: str, folder: str, index: str) -> str:
    """
    Decode a base64-encoded image (data URL) and save it as a PNG file.
    Returns the file path of the saved image.
    """
    header, data = base64_string.split(',', 1)
    img_data = base64.b64decode(data)
    img = Image.open(BytesIO(img_data))
    filename = os.path.join(folder, f"{site_clean}_{index}.png")
    img.save(filename)
    return filename
