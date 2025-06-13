import pandas as pd
import os

# # Define the folder path
# folder_path = "./chrome-extension-xpath-ss/csv/"
# output_path = '/web_extractor/Outputs/segmented-csvs/'

# # Get file names from the user
# file1_name = input("Enter the first CSV file name (e.g., something_structural.csv): ").strip()
# file2_name = input("Enter the second CSV file name (e.g., something_visual.csv): ").strip()

# print(file1_name, file2_name)
# # Construct full file paths
# file1_path = os.path.join(folder_path, file1_name)
# file2_path = os.path.join(folder_path, file2_name)
# # file1_path = './chrome-extension-xpath-ss/csv/amazon_structure.csv'
# # file2_path = './chrome-extension-xpath-ss/csv/amazon_structure.csv'

# # Extract the base file name (before _structural or _visual)
# base_name = file1_name.split("_structural")[0] if "_structural" in file1_name else file1_name.split("_visual")[0]
# print(file1_path, file1_path)
# # Read the CSV files
# df1 = pd.read_csv(file1_path)
# df2 = pd.read_csv(file2_path)

# # Display column names for reference
# print("\nColumns in first file:", df1.columns.tolist())
# print("Columns in second file:", df2.columns.tolist())

# # Ask the user for the common column name
# common_column = "Segment"

# # Rename segment column names
# df1 = df1.rename(columns={common_column: "Segment_Structural"})
# df2 = df2.rename(columns={common_column: "Segment_Virtual"})

# # Merge to find common elements with both segment data
# present_df = df1.merge(df2, left_on="Segment_Structural", right_on="Segment_Virtual", suffixes=('_structural', '_visual'))

# # Find elements that are unique (not present in both files)
# absent_df = pd.concat([df1.rename(columns={"Segment_Structural": common_column}), 
#                        df2.rename(columns={"Segment_Virtual": common_column})]) \
#                .drop_duplicates(subset=[common_column], keep=False)

# # Save results with dynamic names
# present_path = os.path.join(folder_path, f"{base_name}_present.csv")
# absent_path = os.path.join(folder_path, f"{base_name}_absent.csv")
# present_df.to_csv(present_path, index=False)
# absent_df.to_csv(absent_path, index=False)

# print(f"\nFiles saved in {folder_path}:\n- Common elements: '{base_name}_present.csv'\n- Unique elements: '{base_name}_absent.csv'")

import pandas as pd
import os

# Define the folder path
folder_path = "./chrome-extension-xpath-ss/csv/"
output_path = './web_extractor/Outputs/segmented-csvs/'

# Get file names from the user
file1_name = input("Enter the first CSV file name (e.g., something_structural.csv): ").strip()
file2_name = input("Enter the second CSV file name (e.g., something_visual.csv): ").strip()

# Construct full file paths
file1_path = os.path.join(folder_path, file1_name)
file2_path = os.path.join(folder_path, file2_name)

# Extract the base file name (before _structural or _visual)
base_name = os.path.splitext(file1_name)[0].split("_")[0]
print(base_name)

# Read the CSV files
df1 = pd.read_csv(file1_path)
df2 = pd.read_csv(file2_path)

# Display column names for reference
print("\nColumns in first file:", df1.columns.tolist())
print("Columns in second file:", df2.columns.tolist())

# Mapping column names manually since they differ
structural_id_col = "webElementId"
structural_segment_col = "Segment"
visual_id_col = "Web Element ID"
visual_group_col = "Group"

# Rename columns for consistency
df1 = df1.rename(columns={structural_id_col: "Element_ID", structural_segment_col: "Segment_Structural"})
df2 = df2.rename(columns={visual_id_col: "Element_ID", visual_group_col: "Segment_Visual"})

# Merge to find common elements with both segment data
present_df = df1.merge(df2, on="Element_ID", how="inner")

# Find elements that are unique (not present in both files)
absent_df = pd.concat([df1, df2]).drop_duplicates(subset=["Element_ID"], keep=False)

# Save results with dynamic names
present_path = os.path.join(output_path, f"{base_name}_present.csv")
absent_path = os.path.join(output_path, f"{base_name}_missing.csv")

# Save full present_df
present_df.to_csv(present_path, index=False)

# Save only the 'Element_ID' column for absent_df
absent_df[["Element_ID"]].to_csv(absent_path, index=False)

print(f"\nFiles saved in {folder_path}:\n- Common elements: '{base_name}_present.csv'\n- Unique Element IDs: '{base_name}_absent.csv'")

