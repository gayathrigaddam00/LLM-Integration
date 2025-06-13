from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
from datetime import datetime
import os
import shutil  # Import shutil for copying files safely

output_dir = "./Outputs/"
os.makedirs(output_dir, exist_ok=True)

# Define a fixed CSV file that accumulates all data
accumulated_file = os.path.join(output_dir, "accumulated_data.csv")

class ExtractDataView(APIView):
    def post(self, request):
        try:
            elements = request.data.get("elements", [])
            if not elements:
                return Response({"error": "No elements data provided"}, status=status.HTTP_400_BAD_REQUEST)

            batch_df = pd.DataFrame(elements)

            # Append to CSV instead of using global DataFrame
            batch_df.to_csv(accumulated_file, mode="a", index=False, encoding="utf-8", header=not os.path.exists(accumulated_file))

            total_rows = sum(1 for _ in open(accumulated_file)) - 1  # Count rows (excluding header)

            return Response(
                {
                    "message": "Batch received and appended successfully",
                    "rows_received": len(batch_df),
                    "total_rows_accumulated": total_rows,  # Read from file instead of global var
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post_finalize(self, request):
        try:
            if not os.path.exists(accumulated_file) or os.stat(accumulated_file).st_size == 0:
                return Response({"error": "No data to save"}, status=status.HTTP_400_BAD_REQUEST)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            final_output_file = os.path.join(output_dir, f"final_extracted_data_{timestamp}.csv")

            # 🔹 Instead of renaming, copy the file to final location
            shutil.copy(accumulated_file, final_output_file)

            # 🔹 Clear the accumulated file by overwriting it with an empty DataFrame
            pd.DataFrame().to_csv(accumulated_file, index=False)

            return Response(
                {
                    "message": f"Final data saved to {final_output_file}",
                    "total_rows_saved": sum(1 for _ in open(final_output_file)) - 1,  # Exclude header row
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# from rest_framework.views import APIView - WORKING BUT NOIT GOING TO FINAL THING
# from rest_framework.response import Response
# from rest_framework import status
# import pandas as pd
# from datetime import datetime, timedelta
# import os

# output_dir = "./Outputs/"
# os.makedirs(output_dir, exist_ok=True)

# # Define a fixed CSV file that accumulates all data
# accumulated_file = os.path.join(output_dir, "accumulated_data.csv")

# class ExtractDataView(APIView):
#     def post(self, request):
#         try:
#             elements = request.data.get("elements", [])
#             if not elements:
#                 return Response({"error": "No elements data provided"}, status=status.HTTP_400_BAD_REQUEST)

#             batch_df = pd.DataFrame(elements)

#             # Append to CSV instead of using global DataFrame
#             batch_df.to_csv(accumulated_file, mode="a", index=False, encoding="utf-8", header=not os.path.exists(accumulated_file))

#             total_rows = sum(1 for _ in open(accumulated_file)) - 1  # Count rows (excluding header)

#             return Response(
#                 {
#                     "message": "Batch received and appended successfully",
#                     "rows_received": len(batch_df),
#                     "total_rows_accumulated": total_rows,  # Read from file instead of global var
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     def post_finalize(self, request):
#         try:
#             if not os.path.exists(accumulated_file) or os.stat(accumulated_file).st_size == 0:
#                 return Response({"error": "No data to save"}, status=status.HTTP_400_BAD_REQUEST)

#             timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#             final_output_file = os.path.join(output_dir, f"final_extracted_data_{timestamp}.csv")

#             # Rename accumulated file
#             os.rename(accumulated_file, final_output_file)

#             return Response(
#                 {
#                     "message": f"Final data saved to {final_output_file}",
#                     "total_rows_saved": sum(1 for _ in open(final_output_file)) - 1,
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# import pandas as pd
# from datetime import datetime, timedelta
# import os

# # Global storage for accumulated data
# accumulated_df = pd.DataFrame()

# # Directory to save CSV files
# output_dir = "./Outputs/"  # Change as needed
# os.makedirs(output_dir, exist_ok=True)

# # Auto-save conditions
# MAX_ROWS = 100  # Save if 1000 rows accumulate (adjustable)
# SAVE_INTERVAL = timedelta(minutes=5)  # Save every 5 minutes
# last_save_time = datetime.now()  # Track last save time

# class ExtractDataView(APIView):
#     def post(self, request):
#         global accumulated_df, last_save_time  

#         try:
#             # Get batch data
#             elements = request.data.get("elements", [])
#             if not elements:
#                 return Response({"error": "No elements data provided"}, status=status.HTTP_400_BAD_REQUEST)

#             # Convert batch to DataFrame
#             batch_df = pd.DataFrame(elements)
#             accumulated_df = pd.concat([accumulated_df, batch_df], ignore_index=True)

#             # Check if auto-save is needed
#             current_time = datetime.now()
#             if len(accumulated_df) >= MAX_ROWS or (current_time - last_save_time) >= SAVE_INTERVAL:
#                 self.auto_save()
#                 last_save_time = current_time  # Reset timer

#             return Response(
#                 {
#                     "message": "Batch received",
#                     "rows_received": len(batch_df),
#                     "total_rows_accumulated": len(accumulated_df),
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     def auto_save(self):
#         """Automatically saves the accumulated data when a condition is met"""
#         global accumulated_df

#         if accumulated_df.empty:
#             return

#         # Generate a timestamped filename
#         timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#         output_file = os.path.join(output_dir, f"autosaved_data_{timestamp}.csv")

#         # Save accumulated data to CSV
#         accumulated_df.to_csv(output_file, index=False, encoding="utf-8")
#         print(f"Auto-saved data to {output_file}")

#         # Clear accumulated data
#         accumulated_df = pd.DataFrame()


# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# import pandas as pd
# from datetime import datetime  # Import datetime module for batches

# # Global variable to store accumulated data
# accumulated_df = pd.DataFrame()

# class ExtractDataView(APIView):
#     def post(self, request):
#         global accumulated_df  # Access the global DataFrame

#         try:
#             # Get the elements data from the request
#             print("Inside new-views.py")
#             elements = request.data.get("elements", [])
#             if not elements:
#                 return Response({"error": "No elements data provided"}, status=status.HTTP_400_BAD_REQUEST)

#             # Convert the incoming batch into a DataFrame
#             batch_df = pd.DataFrame(elements)

#             # Append the batch to the accumulated DataFrame
#             accumulated_df = pd.concat([accumulated_df, batch_df], ignore_index=True)

#             return Response(
#                 {
#                     "message": "Batch received and appended successfully",
#                     "rows_received": len(batch_df),
#                     "total_rows_accumulated": len(accumulated_df),
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             # Handle unexpected errors
#             return Response(
#                 {"error": f"An error occurred: {str(e)}"},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             )

#     def finalize(self, request):
#         global accumulated_df  # Access the global DataFrame

#         try:
#             # Generate a timestamp for the filename
#             timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")  # Format: YYYYMMDD_HHMMSS
#             output_file = f"extracted_data_{timestamp}.csv"  # Include timestamp in the filename

#             # Save the accumulated DataFrame to a CSV file
#             accumulated_df.to_csv(output_file, index=False, encoding="utf-8")

#             # Clear the accumulated DataFrame
#             accumulated_df = pd.DataFrame()

#             return Response(
#                 {
#                     "message": f"All data saved successfully to {output_file}",
#                     "total_rows_saved": len(accumulated_df),
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             # Handle unexpected errors
#             return Response(
#                 {"error": f"An error occurred: {str(e)}"},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             )

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# import pandas as pd
# import os

# class ExtractDataView(APIView):
#     def post(self, request):
#         try:
#             # Get the elements data from the request
#             print("Inide new-views.py")
#             elements = request.data.get("elements", [])
#             if not elements:
#                 return Response({"error": "No elements data provided"}, status=status.HTTP_400_BAD_REQUEST)
            
#             # Convert the data into a pandas DataFrame
#             df = pd.DataFrame(elements)

#             # Specify the output CSV file path
#             output_file = "extracted_elements.csv"

#             # Save the DataFrame to a CSV file
#             df.to_csv(output_file, index=False, encoding="utf-8")
            
#             return Response(
#                 {
#                     "message": f"Data saved successfully to {output_file}",
#                     "rows_saved": len(df),
#                 },
#                 status=status.HTTP_200_OK,
#             )
#         except Exception as e:
#             # Handle unexpected errors
#             return Response(
#                 {"error": f"An error occurred: {str(e)}"},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             )
